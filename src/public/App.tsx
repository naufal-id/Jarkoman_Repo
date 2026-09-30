import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { api, ApiError } from '../shared/api'
import { defaultState } from '../shared/defaults'
import { gameDef } from '../shared/games'
import { cleanJarkoman, cleanState } from '../shared/sanitize'
import { KEYS, LEGACY_KEYS, readJSON, removeKey, writeJSON } from '../shared/storage'
import type { GameId, Jarkoman, SiteState } from '../shared/types'
import { PageCtx, type ThemeProps } from './common/context'
import { useMedia } from './common/hooks'
import { ScrollTrigger } from './common/gsap'
import { ToastProvider } from './common/Toast'

const THEMES: Record<GameId, ComponentType<ThemeProps>> = {
  valorant: lazy(() => import('./themes/valorant/ValorantPage')),
  cs2: lazy(() => import('./themes/cs2/Cs2Page')),
  mlbb: lazy(() => import('./themes/mlbb/MlbbPage')),
  repo: lazy(() => import('./themes/repo/RepoPage')),
}

type Load =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; state: SiteState; sample: boolean; offline: boolean }

const params = new URLSearchParams(location.search)
const PREVIEW = params.get('preview') === '1'
const WANTED = params.get('id')
/** Skuad di halaman ikut diperbarui saat orang lain mendaftar, tanpa memuat ulang halaman. */
const REFRESH_MS = 45_000

LEGACY_KEYS.forEach((k) => removeKey(k))

export function App() {
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [previewData, setPreviewData] = useState<{ item: Jarkoman; others: Jarkoman[] } | null>(null)
  const [replay, setReplay] = useState(0)

  // Hanya respons dari permintaan terakhir yang dipakai (permintaan lama yang telat selesai diabaikan).
  const reqId = useRef(0)

  const fetchState = useCallback(async () => {
    const id = ++reqId.current
    setLoad({ kind: 'loading' })
    try {
      const remote = await api.getState()
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
      setLoad((l) => (l.kind === 'ready' && !l.sample && JSON.stringify(l.state) === JSON.stringify(cleaned) ? l : { kind: 'ready', state: cleaned, sample: false, offline: false }))
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
    const byId = WANTED ? state.items.find((i) => i.id === WANTED) : undefined
    const item = byId ?? state.items.find((i) => i.id === state.featuredId) ?? state.items[0]
    if (!item) return null
    return {
      item,
      others: state.items.filter((i) => i.id !== item.id),
      sample: load.sample,
      offline: load.offline,
      missing: Boolean(WANTED && !byId),
    }
  }, [load, previewData])

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
  const Theme = THEMES[item.game]

  useEffect(() => {
    document.documentElement.dataset.game = item.game
    document.title = `${item.headline} · ${def.name} | Jarkoman`
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', def.themeColor)
  }, [item.game, item.headline, def])

  return (
    <PageCtx.Provider value={{ preview: PREVIEW, others, replay, media, ready: true, replaceItem }}>
      <a className="skip-link" href="#join">
        Langsung ke form konfirmasi
      </a>
      {banner && <div className="data-banner">{banner}</div>}
      <Suspense fallback={<SystemScreen text={`Menyiapkan tema ${def.name}…`} busy />}>
        <Theme j={item} />
      </Suspense>
    </PageCtx.Provider>
  )
}

function SystemScreen({ text, busy, children }: { text: string; busy?: boolean; children?: React.ReactNode }) {
  return (
    <main className="sys" aria-busy={busy || undefined}>
      <p className="sys__mark">
        JARKOMAN{busy && <span aria-hidden="true">_</span>}
      </p>
      <p className="sys__text" role={busy ? 'status' : 'alert'}>
        {text}
      </p>
      {children && <div className="sys__actions">{children}</div>}
    </main>
  )
}
