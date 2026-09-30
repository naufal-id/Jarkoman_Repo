import { Suspense, use, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { flushSync } from 'react-dom'
import { api, ApiError } from '../shared/api'
import { defaultState } from '../shared/defaults'
import { artSrcSet, HERO_SIZES, KEY_ART } from '../shared/art'
import { gameDef } from '../shared/games'
import { cleanJarkoman, cleanState } from '../shared/sanitize'
import { KEYS, LEGACY_KEYS, readJSON, removeKey, writeJSON } from '../shared/storage'
import type { GameId, Jarkoman, SiteState } from '../shared/types'
import { PageCtx, type ThemeProps } from './common/context'
import { useMedia } from './common/hooks'
import { ScrollTrigger } from './common/gsap'
import { ToastProvider } from './common/Toast'

const THEME_LOADERS: Record<GameId, () => Promise<{ default: ComponentType<ThemeProps> }>> = {
  valorant: () => import('./themes/valorant/ValorantPage'),
  cs2: () => import('./themes/cs2/Cs2Page'),
  mlbb: () => import('./themes/mlbb/MlbbPage'),
  repo: () => import('./themes/repo/RepoPage'),
}

/**
 * Komponen tema yang sudah dimuat. Berbeda dengan React.lazy, tema yang modulnya sudah ada langsung dirender tanpa
 * menangguhkan render pertama, jadi perpindahan jarkoman di dalam View Transition tidak menangkap layar tunggu.
 */
const LOADED: Partial<Record<GameId, ComponentType<ThemeProps>>> = {}
const LOADING: Partial<Record<GameId, Promise<void>>> = {}

type Tracked = Promise<void> & { status?: 'fulfilled' | 'rejected'; value?: unknown; reason?: unknown }

function loadTheme(game: GameId): Promise<void> {
  let p = LOADING[game]
  if (!p) {
    const tracked: Tracked = THEME_LOADERS[game]().then((m) => {
      LOADED[game] = m.default
    })
    // Tandai status promise seperti yang dibaca React di use(): promise yang sudah selesai langsung dipakai tanpa
    // menangguhkan render (tidak ada layar tunggu di tengah View Transition).
    tracked.then(
      () => {
        tracked.status = 'fulfilled'
        tracked.value = undefined
      },
      (err) => {
        tracked.status = 'rejected'
        tracked.reason = err
        delete LOADING[game]
      },
    )
    LOADING[game] = p = tracked
  }
  return p
}

function ThemeHost({ game, j }: { game: GameId; j: Jarkoman }) {
  use(loadTheme(game))
  const Theme = LOADED[game]!
  return <Theme j={j} />
}

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; state: SiteState; sample: boolean; offline: boolean }

const params = new URLSearchParams(location.search)
const PREVIEW = params.get('preview') === '1'
const WANTED = params.get('id')
/** Skuad di halaman ikut diperbarui saat orang lain mendaftar, tanpa memuat ulang halaman. */
const REFRESH_MS = 45_000

LEGACY_KEYS.forEach((k) => removeKey(k))

/**
 * index.html mulai mengambil /api/state bersamaan dengan unduhan JS (window.__jkState). Hasilnya dipakai sekali
 * untuk muat pertama; kalau gagal atau tidak ada, App mengambil ulang lewat api.getState seperti biasa.
 */
async function takeEarlyState(): Promise<SiteState | null | undefined> {
  const w = window as { __jkState?: Promise<{ state?: SiteState | null } | null> }
  const early = w.__jkState
  delete w.__jkState
  if (!early) return undefined
  const body = await early.catch(() => null)
  return body && 'state' in body ? (body.state ?? null) : undefined
}

let preloaded = false
/** Mulai unduh gambar hero sebelum chunk tema selesai dimuat (gambar ini biasanya elemen LCP). */
function preloadHeroArt(item: Jarkoman) {
  if (preloaded || PREVIEW) return
  preloaded = true
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'image'
  link.setAttribute('fetchpriority', 'high')
  if (item.bg) {
    link.href = item.bg
    link.referrerPolicy = 'no-referrer'
  } else {
    link.href = KEY_ART[item.game].src
    const set = artSrcSet(item.game)
    if (set) {
      link.setAttribute('imagesrcset', set)
      link.setAttribute('imagesizes', HERO_SIZES[item.game])
    }
  }
  document.head.appendChild(link)
}

export function App() {
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [previewData, setPreviewData] = useState<{ item: Jarkoman; others: Jarkoman[] } | null>(null)
  const [replay, setReplay] = useState(0)
  // Jarkoman yang sedang dibuka (?id=). Bisa berganti tanpa memuat ulang halaman lewat link "Jadwal lain".
  const [wanted, setWanted] = useState<string | null>(WANTED)

  // Hanya respons dari permintaan terakhir yang dipakai (permintaan lama yang telat selesai diabaikan).
  const reqId = useRef(0)

  const fetchState = useCallback(async () => {
    const id = ++reqId.current
    setLoad({ kind: 'loading' })
    try {
      const early = await takeEarlyState()
      const remote = early !== undefined ? early : await api.getState()
      if (id !== reqId.current) return
      const cleaned = remote ? cleanState(remote)?.state : null
      if (cleaned && cleaned.items.length) {
        writeJSON(KEYS.lastState, cleaned)
        setLoad({ kind: 'ready', state: cleaned, sample: false, offline: false })
      } else {
        setLoad({ kind: 'ready', state: defaultState(), sample: true, offline: false })
      }
    } catch (err) {
      if (id !== reqId.current) return
      const cached = cleanState(readJSON(KEYS.lastState))?.state
      if (cached && cached.items.length) {
        setLoad({ kind: 'ready', state: cached, sample: false, offline: true })
      } else if (err instanceof ApiError && err.code === 'no-api') {
        setLoad({ kind: 'ready', state: defaultState(), sample: true, offline: false })
      } else {
        setLoad({ kind: 'error', message: err instanceof Error ? err.message : 'Terjadi kesalahan.' })
      }
    }
  }, [])

  // Refresh diam hanya boleh berjalan setelah muat pertama selesai. Kalau tidak, ia membatalkan hasil muat
  // pertama lewat reqId, dan saat refresh gagal halaman tertahan di layar loading.
  const ready = useRef(false)
  ready.current = load.kind === 'ready'

  // Ambil ulang tanpa layar loading. Hanya menimpa data kalau isinya memang berubah.
  const refreshQuietly = useCallback(async () => {
    if (!ready.current) return
    const id = ++reqId.current
    try {
      const remote = await api.getState()
      const cleaned = remote ? cleanState(remote)?.state : null
      if (id !== reqId.current || !cleaned || !cleaned.items.length) return
      writeJSON(KEYS.lastState, cleaned)
      setLoad((l) =>
        l.kind === 'ready' && !l.sample && JSON.stringify(l.state) === JSON.stringify(cleaned) ? l : { kind: 'ready', state: cleaned, sample: false, offline: false },
      )
    } catch {
      // Diam saja: data yang sedang tampil tetap dipakai.
    }
  }, [])

  const replaceItem = useCallback((item: Jarkoman) => {
    if (PREVIEW) return
    reqId.current++
    setLoad((l) => {
      if (l.kind !== 'ready') return l
      const state = { ...l.state, items: l.state.items.map((i) => (i.id === item.id ? item : i)) }
      writeJSON(KEYS.lastState, state)
      return { ...l, state, offline: false }
    })
  }, [])

  useEffect(() => {
    if (PREVIEW) return
    const tick = () => {
      if (!document.hidden) refreshQuietly()
    }
    const timer = window.setInterval(tick, REFRESH_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [refreshQuietly])

  useEffect(() => {
    if (!PREVIEW) {
      fetchState()
      return () => {
        reqId.current++
      }
    }
    // Mode preview: data dikirim dashboard admin lewat postMessage (origin yang sama saja).
    let received = false
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin || !e.data || typeof e.data !== 'object') return
      if (e.data.type === 'jk:preview') {
        const item = cleanJarkoman(e.data.item)
        if (!item) return
        received = true
        const others = (Array.isArray(e.data.others) ? e.data.others : []).map((o: unknown) => cleanJarkoman(o)).filter(Boolean) as Jarkoman[]
        setPreviewData({ item, others })
      }
      if (e.data.type === 'jk:replay') setReplay((n) => n + 1)
    }
    window.addEventListener('message', onMessage)
    // Kirim "siap" berulang sampai data pertama datang, kalau-kalau dashboard belum mendengarkan.
    const hello = () => !received && window.parent?.postMessage({ type: 'jk:ready' }, location.origin)
    hello()
    const timer = window.setInterval(hello, 1000)
    return () => {
      window.removeEventListener('message', onMessage)
      window.clearInterval(timer)
    }
  }, [fetchState])

  // Di preview, link internal (jadwal lain, admin) tidak boleh memindahkan iframe keluar dari mode preview.
  useEffect(() => {
    if (!PREVIEW) return
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a')
      if (!a || a.target === '_blank') return
      const url = new URL(a.href, location.href)
      if (url.origin === location.origin && !(url.pathname === location.pathname && url.hash)) e.preventDefault()
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  // Di preview, tinggi konten berubah setiap admin mengetik. Posisi ScrollTrigger perlu dihitung ulang.
  useEffect(() => {
    if (!PREVIEW) return
    let t = 0
    const ro = new ResizeObserver(() => {
      window.clearTimeout(t)
      t = window.setTimeout(() => ScrollTrigger.refresh(), 200)
    })
    ro.observe(document.body)
    return () => ro.disconnect()
  }, [])

  const view = useMemo(() => {
    if (PREVIEW) return previewData ? { item: previewData.item, others: previewData.others, sample: false, offline: false, missing: false } : null
    if (load.kind !== 'ready') return null
    const { state } = load
    const byId = wanted ? state.items.find((i) => i.id === wanted) : undefined
    const item = byId ?? state.items.find((i) => i.id === state.featuredId) ?? state.items[0]
    if (!item) return null
    return {
      item,
      others: state.items.filter((i) => i.id !== item.id),
      sample: load.sample,
      offline: load.offline,
      missing: Boolean(wanted && !byId),
    }
  }, [load, previewData, wanted])

  // Pindah ke jarkoman lain dari "Jadwal lain" tanpa memuat ulang: chunk tema dimuat dulu, lalu tampilan diganti
  // di dalam View Transition (thumbnail jadwal berubah jadi gambar hero). Tombol Back/Forward browser ikut bekerja.
  const items = load.kind === 'ready' ? load.state.items : null
  const itemsRef = useRef(items)
  itemsRef.current = items
  useEffect(() => {
    if (PREVIEW) return
    let seq = 0
    const go = async (id: string, push: boolean, href: string) => {
      const target = itemsRef.current?.find((i) => i.id === id)
      if (!target) {
        if (push) location.href = href
        else setWanted(id || null)
        return
      }
      const mine = ++seq
      await loadTheme(target.game).catch(() => null)
      if (mine !== seq) return
      // Intro game hanya untuk kunjungan pertama; perpindahan di dalam situs langsung ke halaman.
      writeJSON(KEYS.introSeen(target.game), 1, 'session')
      if (push) history.pushState({ id }, '', href)
      const apply = () => {
        flushSync(() => setWanted(id))
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      }
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
      if (typeof document.startViewTransition === 'function' && !reduce) document.startViewTransition(apply)
      else apply()
    }
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a')
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
      const url = new URL(a.href, location.href)
      const id = url.searchParams.get('id')
      if (url.origin !== location.origin || url.pathname !== '/' || !id || url.hash) return
      e.preventDefault()
      void go(id, true, url.pathname + url.search)
    }
    const onPop = () => void go(new URLSearchParams(location.search).get('id') ?? '', false, location.pathname + location.search)
    document.addEventListener('click', onClick)
    window.addEventListener('popstate', onPop)
    return () => {
      document.removeEventListener('click', onClick)
      window.removeEventListener('popstate', onPop)
    }
  }, [])

  const heroItem = view?.item
  useEffect(() => {
    if (heroItem) preloadHeroArt(heroItem)
  }, [heroItem])

  if (PREVIEW && !view) return <SystemScreen text="Menunggu data dari editor…" busy />
  if (load.kind === 'loading' && !PREVIEW) return <SystemScreen text="Mengambil jadwal mabar terbaru…" busy />
  if (load.kind === 'error' && !PREVIEW)
    return (
      <SystemScreen text={`Jadwal gagal dimuat. ${load.message}`}>
        <button className="sys__btn" onClick={fetchState}>
          Coba muat lagi
        </button>
      </SystemScreen>
    )
  if (!view)
    return (
      <SystemScreen text="Belum ada jarkoman yang dipasang. Host bisa membuatnya dari dashboard admin.">
        <a className="sys__btn sys__btn--ghost" href="/admin/">
          Buka dashboard admin
        </a>
      </SystemScreen>
    )

  return (
    <ToastProvider>
      <Stage
        item={view.item}
        others={view.others}
        replay={replay}
        replaceItem={replaceItem}
        banner={
          view.sample ? (
            <>
              Ini jarkoman contoh. Host belum menyimpan jadwal asli di <a href="/admin/">dashboard admin</a>.
            </>
          ) : view.offline ? (
            'Koneksi ke server gagal. Yang tampil adalah data terakhir yang tersimpan di perangkat ini.'
          ) : view.missing ? (
            'Jarkoman dari link itu sudah tidak ada. Yang tampil adalah jadwal utama saat ini.'
          ) : null
        }
      />
    </ToastProvider>
  )
}

interface StageProps {
  item: Jarkoman
  others: Jarkoman[]
  replay: number
  replaceItem: (item: Jarkoman) => void
  banner: React.ReactNode
}

function Stage({ item, others, replay, replaceItem, banner }: StageProps) {
  const def = gameDef(item.game)
  const media = useMedia(item.game)

  useEffect(() => {
    document.documentElement.dataset.game = item.game
    document.title = `${item.headline} · ${def.name} | Jarkoman`
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', def.themeColor)
    // Ikon tab ikut game: huruf JK dengan warna identitas game itu.
    document.querySelector('link[rel="icon"]')?.setAttribute('href', `/favicon-${item.game}.svg`)
  }, [item.game, item.headline, def])

  return (
    <PageCtx.Provider value={{ preview: PREVIEW, others, replay, media, ready: true, replaceItem }}>
      <a className="skip-link" href="#join">
        Langsung ke form konfirmasi
      </a>
      {banner && <div className="data-banner">{banner}</div>}
      <Suspense fallback={<SystemScreen text={`Menyiapkan tema ${def.name}…`} busy />}>
        <ThemeHost key={item.id} game={item.game} j={item} />
      </Suspense>
    </PageCtx.Provider>
  )
}

function SystemScreen({ text, busy, children }: { text: string; busy?: boolean; children?: React.ReactNode }) {
  return (
    <main className="sys" aria-busy={busy || undefined}>
      <p className="sys__mark">JARKOMAN{busy && <span aria-hidden="true">_</span>}</p>
      <p className="sys__text" role={busy ? 'status' : 'alert'}>
        {text}
      </p>
      {children && <div className="sys__actions">{children}</div>}
    </main>
  )
}
