import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { api, ApiError } from '../shared/api'
import { createJarkoman, defaultState, switchGame } from '../shared/defaults'
import { GAMES, gameDef } from '../shared/games'
import { uid } from '../shared/ids'
import { cleanState } from '../shared/sanitize'
import { KEYS, readJSON, removeKey, writeJSON } from '../shared/storage'
import { formatClock, formatDateShort, parseDate } from '../shared/time'
import { GAME_IDS } from '../shared/types'
import type { GameId, Jarkoman, SiteState } from '../shared/types'
import { buildBroadcast, playersIn } from '../shared/wa'
import { copyText } from '../public/common/actions'
import { ToastProvider, useToast } from '../public/common/Toast'
import { Dialog } from './Dialog'
import { Editor } from './Editor'
import { Preview } from './Preview'

interface DraftStore {
  base: number
  state: SiteState
}

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready' }
type Pane = 'list' | 'edit' | 'preview'
type Modal = null | { type: 'new' } | { type: 'delete'; id: string } | { type: 'broadcast' } | { type: 'import'; state: SiteState } | { type: 'conflict'; server: SiteState }

interface Props {
  token: string
  onLogout: (notice?: string) => void
}

export function Dashboard(props: Props) {
  return (
    <ToastProvider>
      <DashboardInner {...props} />
    </ToastProvider>
  )
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const linkFor = (id: string) => `${location.origin}/?id=${encodeURIComponent(id)}`

/** Tandai item yang berubah dengan updatedAt baru sebelum dikirim ke server. */
function stamp(draft: SiteState, saved: SiteState): SiteState {
  const before = new Map(saved.items.map((i) => [i.id, JSON.stringify(i)]))
  const now = Date.now()
  return {
    ...draft,
    items: draft.items.map((i) => (before.get(i.id) === JSON.stringify(i) ? i : { ...i, updatedAt: now })),
  }
}

function ago(ms: number, now: number): string {
  const s = Math.max(0, Math.round((now - ms) / 1000))
  if (s < 45) return 'barusan'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} menit lalu`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} jam lalu`
  return `${Math.round(h / 24)} hari lalu`
}

function DashboardInner({ token, onLogout }: Props) {
  const toast = useToast()
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [saved, setSaved] = useState<SiteState | null>(null)
  const [draft, setDraft] = useState<SiteState | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState<Modal>(null)
  const [pane, setPane] = useState<Pane>('edit')
  const [restored, setRestored] = useState(false)
  const [replay, setReplay] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const fetchState = useCallback(async () => {
    setLoad({ kind: 'loading' })
    try {
      const server = await api.getState()
      const base = (server && cleanState(server)?.state) || defaultState()
      const local = readJSON<DraftStore>(KEYS.draft)
      let working = base
      if (local && local.base === base.updatedAt && Array.isArray(local.state?.items) && local.state.items.length && !same(local.state, base)) {
        working = local.state
        setRestored(true)
      }
      setSaved(base)
      setDraft(working)
      setSelectedId(working.featuredId || working.items[0]?.id || '')
      setLoad({ kind: 'ready' })
    } catch (err) {
      setLoad({ kind: 'error', message: err instanceof ApiError ? err.message : 'Gagal memuat data.' })
    }
  }, [])

  useEffect(() => {
    fetchState()
  }, [fetchState])

  const dirty = Boolean(draft && saved && !same(draft, saved))
  const neverSaved = saved?.updatedAt === 0

  // Draft disimpan di perangkat supaya tidak hilang saat tab tertutup atau sesi login habis.
  useEffect(() => {
    if (!draft || !saved) return
    if (dirty) writeJSON(KEYS.draft, { base: saved.updatedAt, state: draft } satisfies DraftStore)
    else removeKey(KEYS.draft)
  }, [draft, saved, dirty])

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const current = useMemo(() => draft?.items.find((i) => i.id === selectedId) ?? draft?.items[0] ?? null, [draft, selectedId])
  const others = useMemo(() => draft?.items.filter((i) => i.id !== current?.id) ?? [], [draft, current])

  const patchCurrent = useCallback(
    (patch: Partial<Jarkoman>) => {
      if (!current) return
      setDraft((d) => (d ? { ...d, items: d.items.map((i) => (i.id === current.id ? { ...i, ...patch } : i)) } : d))
    },
    [current],
  )

  const changeGame = (game: GameId) => {
    if (!current || current.game === game) return
    setDraft((d) => (d ? { ...d, items: d.items.map((i) => (i.id === current.id ? switchGame(i, game) : i)) } : d))
    setReplay((n) => n + 1)
  }

  const save = useCallback(
    async (force = false) => {
      if (!draft || !saved || saving) return
      const invalid = draft.items.find((i) => !parseDate(i.date))
      if (invalid) {
        setSelectedId(invalid.id)
        toast('Tanggal salah satu jarkoman belum valid.')
        return
      }
      setSaving(true)
      try {
        const next = await api.saveState(stamp(draft, saved), token, saved.updatedAt, force)
        setSaved(next)
        setDraft(next)
        setRestored(false)
        removeKey(KEYS.draft)
        if (!next.items.some((i) => i.id === selectedId)) setSelectedId(next.featuredId)
        toast('Tersimpan. Halaman publik sudah memakai versi ini.')
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          onLogout('Sesi login habis. Masuk lagi, perubahanmu tersimpan sebagai draft di perangkat ini.')
        } else if (err instanceof ApiError && err.status === 409 && err.data.state) {
          setModal({ type: 'conflict', server: err.data.state as SiteState })
        } else {
          toast(err instanceof Error ? `Gagal menyimpan: ${err.message}` : 'Gagal menyimpan.')
        }
      } finally {
        setSaving(false)
      }
    },
    [draft, saved, saving, token, selectedId, toast, onLogout],
  )

  // Ctrl/Cmd + S untuk simpan.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  if (load.kind === 'loading' || !draft || !saved) {
    if (load.kind === 'error') {
      return (
        <main className="adm-boot">
          <p className="adm-boot__mark">JARKOMAN</p>
          <p role="alert">Data jarkoman gagal dimuat. {load.message}</p>
          <button className="adm-btn adm-btn--primary" type="button" onClick={fetchState}>
            Muat ulang
          </button>
        </main>
      )
    }
    return (
      <main className="adm-boot" aria-busy="true">
        <p className="adm-boot__mark">JARKOMAN</p>
        <p role="status">Mengambil data jarkoman…</p>
      </main>
    )
  }

  const addItem = (game: GameId) => {
    const item = createJarkoman(game)
    setDraft({ ...draft, items: [item, ...draft.items] })
    setSelectedId(item.id)
    setModal(null)
    setPane('edit')
    setReplay((n) => n + 1)
  }

  const duplicate = (item: Jarkoman) => {
    const p = parseDate(item.date)
    const next = p ? new Date(Date.UTC(p.y, p.m - 1, p.d + 7)).toISOString().slice(0, 10) : item.date
    const copy: Jarkoman = { ...item, id: uid(), date: next, players: [], status: 'open' }
    setDraft({ ...draft, items: [copy, ...draft.items] })
    setSelectedId(copy.id)
    toast('Disalin untuk minggu depan. Roster dikosongkan.')
  }

  const remove = (id: string) => {
    const items = draft.items.filter((i) => i.id !== id)
    const featuredId = draft.featuredId === id ? (items[0]?.id ?? '') : draft.featuredId
    setDraft({ ...draft, items, featuredId })
    setSelectedId(featuredId || items[0]?.id || '')
    setModal(null)
    toast('Jarkoman dihapus dari draft. Tekan Simpan untuk menerapkan.')
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `jarkoman-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 3000)
  }

  const importFile = async (file: File) => {
    try {
      const parsed = cleanState(JSON.parse(await file.text()))
      if (!parsed || parsed.state.items.length === 0) throw new Error('kosong')
      setModal({ type: 'import', state: parsed.state })
    } catch {
      toast('File tidak bisa dibaca. Pastikan itu file cadangan JSON dari Jarkoman.')
    }
  }

  const status = saving ? 'Menyimpan…' : dirty ? 'Ada perubahan yang belum disimpan' : neverSaved ? 'Belum pernah dipublikasikan' : `Tersimpan ${ago(saved.updatedAt, now)}`
  const accent = current ? GAMES[current.game].accent : '#ece8e1'
  const published = !neverSaved && saved.items.some((i) => i.id === current?.id)

  return (
    <div className="adm" style={{ '--acc': accent } as CSSProperties} data-pane={pane}>
      <header className="adm-top">
        <p className="adm-top__mark">
          JARKOMAN <span>admin</span>
        </p>
        <p className={`adm-top__status ${dirty ? 'is-dirty' : ''}`} role="status">
          {status}
        </p>
        <div className="adm-top__actions">
          <button type="button" className="adm-btn adm-btn--ghost adm-hide-sm" onClick={() => setModal({ type: 'broadcast' })} disabled={!current}>
            Teks untuk grup WA
          </button>
          <button
            type="button"
            className="adm-btn adm-btn--ghost adm-hide-sm"
            onClick={async () => current && toast((await copyText(linkFor(current.id))) ? 'Link jarkoman disalin.' : 'Gagal menyalin link.')}
            disabled={!current}
          >
            Salin link
          </button>
          <button type="button" className="adm-btn adm-btn--primary" onClick={() => save()} disabled={saving || (!dirty && !neverSaved)}>
            {saving ? 'Menyimpan…' : neverSaved ? 'Publikasikan' : 'Simpan'}
          </button>
        </div>
      </header>

      {restored && (
        <div className="adm-banner" role="status">
          <p>Draft yang belum disimpan dari kunjungan sebelumnya dipulihkan.</p>
          <button
            type="button"
            className="adm-btn adm-btn--ghost adm-btn--sm"
            onClick={() => {
              setDraft(saved)
              setSelectedId(saved.featuredId || saved.items[0]?.id || '')
              setRestored(false)
              removeKey(KEYS.draft)
            }}
          >
            Buang draft
          </button>
        </div>
      )}

      <div className="adm-body">
        <aside className="adm-list" aria-label="Daftar jarkoman">
          <div className="adm-list__head">
            <h2 className="adm-list__title">Jarkoman</h2>
            <button type="button" className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => setModal({ type: 'new' })}>
              Buat baru
            </button>
          </div>
          {draft.items.length === 0 ? (
            <div className="adm-empty">
              <p>Belum ada jarkoman. Buat satu untuk mulai ngajak mabar.</p>
            </div>
          ) : (
            <ul className="adm-list__items">
              {draft.items.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    className={`adm-item ${i.id === current?.id ? 'is-on' : ''}`}
                    aria-current={i.id === current?.id ? 'true' : undefined}
                    data-game={i.game}
                    style={{ '--acc': GAMES[i.game].accent } as CSSProperties}
                    onClick={() => {
                      setSelectedId(i.id)
                      setPane('edit')
                    }}
                  >
                    <span className="adm-item__game">{GAMES[i.game].name}</span>
                    <span className="adm-item__headline">{i.headline || 'Tanpa judul'}</span>
                    <span className="adm-item__meta">
                      {formatDateShort(i.date)} · {formatClock(i.time)} {i.tz} · {playersIn(i)}/{i.slots}
                    </span>
                    <span className="adm-item__badges">
                      {i.id === draft.featuredId && <span className="adm-badge adm-badge--main">Utama</span>}
                      {i.status === 'cancelled' && <span className="adm-badge">Batal</span>}
                      {i.status === 'done' && <span className="adm-badge">Selesai</span>}
                      {!saved.items.some((s) => s.id === i.id) && <span className="adm-badge">Baru</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="adm-list__foot">
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm adm-show-sm" onClick={() => setModal({ type: 'broadcast' })} disabled={!current}>
              Teks untuk grup WA
            </button>
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={exportJson}>
              Ekspor cadangan
            </button>
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => fileRef.current?.click()}>
              Impor cadangan
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) importFile(f)
                e.target.value = ''
              }}
            />
            <a className="adm-btn adm-btn--ghost adm-btn--sm" href="/" target="_blank" rel="noopener noreferrer">
              Lihat situs
            </a>
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => onLogout('Kamu sudah keluar.')}>
              Keluar
            </button>
          </div>
        </aside>

        <main className="adm-editor" id="editor">
          {current ? (
            <>
              <div className="adm-editor__head">
                <div>
                  <p className="adm-editor__kicker" style={{ fontFamily: `var(--font-${current.game})` }}>
                    {gameDef(current.game).fullName}
                  </p>
                  <h1 className="adm-editor__title">{current.headline || 'Tanpa judul'}</h1>
                </div>
                <div className="adm-editor__actions">
                  {draft.featuredId === current.id ? (
                    <span className="adm-badge adm-badge--main adm-badge--lg">Jarkoman utama</span>
                  ) : (
                    <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setDraft({ ...draft, featuredId: current.id })}>
                      Jadikan utama
                    </button>
                  )}
                  <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => duplicate(current)}>
                    Duplikat minggu depan
                  </button>
                  <button
                    type="button"
                    className="adm-btn adm-btn--danger adm-btn--sm"
                    onClick={() => setModal({ type: 'delete', id: current.id })}
                    disabled={draft.items.length <= 1}
                    title={draft.items.length <= 1 ? 'Minimal harus ada satu jarkoman' : undefined}
                  >
                    Hapus
                  </button>
                </div>
              </div>
              <p className="adm-editor__help">
                Jarkoman utama tampil di alamat utama situs. Yang lain bisa dibuka lewat link masing-masing dan muncul di bagian "jadwal lain".
              </p>
              <Editor key={current.id} item={current} onPatch={patchCurrent} onGame={changeGame} />
            </>
          ) : (
            <div className="adm-empty">
              <p>Pilih atau buat jarkoman dulu.</p>
            </div>
          )}
        </main>

        <section className="adm-side" aria-label="Preview">
          {current && <Preview item={current} others={others} replay={replay} published={published} />}
        </section>
      </div>

      <nav className="adm-tabs" aria-label="Panel">
        {(
          [
            ['list', 'Daftar'],
            ['edit', 'Edit'],
            ['preview', 'Preview'],
          ] as [Pane, string][]
        ).map(([p, label]) => (
          <button key={p} type="button" className={`adm-tabs__btn ${pane === p ? 'is-on' : ''}`} aria-pressed={pane === p} onClick={() => setPane(p)}>
            {label}
          </button>
        ))}
      </nav>

      <Dialog
        open={modal?.type === 'new'}
        title="Jarkoman baru untuk game apa?"
        onClose={() => setModal(null)}
        actions={
          <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setModal(null)}>
            Batal
          </button>
        }
      >
        <div className="adm-new">
          {GAME_IDS.map((g) => (
            <button key={g} type="button" className="adm-game adm-game--btn" data-game={g} style={{ '--acc': GAMES[g].accent } as CSSProperties} onClick={() => addItem(g)}>
              <span className="adm-game__name">{GAMES[g].name}</span>
              <span className="adm-game__pub">{GAMES[g].publisher}</span>
            </button>
          ))}
        </div>
      </Dialog>

      <Dialog
        open={modal?.type === 'delete'}
        tone="danger"
        title="Hapus jarkoman ini?"
        onClose={() => setModal(null)}
        actions={
          <>
            <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setModal(null)}>
              Batal
            </button>
            <button type="button" className="adm-btn adm-btn--danger" onClick={() => modal?.type === 'delete' && remove(modal.id)}>
              Ya, hapus
            </button>
          </>
        }
      >
        <p className="adm-dialog__text">
          "{draft.items.find((i) => modal?.type === 'delete' && i.id === modal.id)?.headline}" akan hilang dari daftar. Link yang sudah dibagikan akan menampilkan jarkoman utama.
          Perubahan baru berlaku setelah kamu menekan Simpan.
        </p>
      </Dialog>

      <Dialog
        open={modal?.type === 'broadcast'}
        title="Teks jarkoman untuk grup WhatsApp"
        onClose={() => setModal(null)}
        actions={
          current && (
            <>
              <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setModal(null)}>
                Tutup
              </button>
              <a
                className="adm-btn adm-btn--ghost"
                href={`https://wa.me/?text=${encodeURIComponent(buildBroadcast(current, linkFor(current.id)))}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Kirim lewat WhatsApp
              </a>
              <button
                type="button"
                className="adm-btn adm-btn--primary"
                onClick={async () => toast((await copyText(buildBroadcast(current, linkFor(current.id)))) ? 'Teks disalin. Tempel di grup WA.' : 'Gagal menyalin.')}
              >
                Salin teks
              </button>
            </>
          )
        }
      >
        {dirty && <p className="adm-note adm-note--warn">Ada perubahan yang belum disimpan. Simpan dulu supaya isi link sama dengan teks ini.</p>}
        {current && <textarea className="adm-input adm-broadcast" readOnly rows={14} value={buildBroadcast(current, linkFor(current.id))} aria-label="Teks jarkoman" />}
        <p className="adm-hint">Format *tebal* akan tampil tebal di WhatsApp. Link di akhir teks membuka halaman jarkoman ini.</p>
      </Dialog>

      <Dialog
        open={modal?.type === 'import'}
        title="Ganti isi dengan file cadangan?"
        onClose={() => setModal(null)}
        actions={
          <>
            <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setModal(null)}>
              Batal
            </button>
            <button
              type="button"
              className="adm-btn adm-btn--primary"
              onClick={() => {
                if (modal?.type !== 'import') return
                setDraft({ ...modal.state, updatedAt: draft.updatedAt })
                setSelectedId(modal.state.featuredId)
                setModal(null)
                toast('Cadangan dimuat ke draft. Tekan Simpan untuk menerapkan.')
              }}
            >
              Muat ke draft
            </button>
          </>
        }
      >
        <p className="adm-dialog__text">
          File berisi {modal?.type === 'import' ? modal.state.items.length : 0} jarkoman. Semua jarkoman di draft akan diganti. Halaman publik baru berubah setelah kamu menekan
          Simpan.
        </p>
      </Dialog>

      <Dialog
        open={modal?.type === 'conflict'}
        title="Ada versi lebih baru"
        onClose={() => setModal(null)}
        actions={
          <>
            <button
              type="button"
              className="adm-btn adm-btn--ghost"
              onClick={() => {
                if (modal?.type !== 'conflict') return
                setSaved(modal.server)
                setDraft(modal.server)
                setSelectedId(modal.server.featuredId)
                removeKey(KEYS.draft)
                setModal(null)
              }}
            >
              Pakai versi server
            </button>
            <button
              type="button"
              className="adm-btn adm-btn--danger"
              onClick={() => {
                setModal(null)
                save(true)
              }}
            >
              Timpa dengan versiku
            </button>
          </>
        }
      >
        <p className="adm-dialog__text">
          Jarkoman sudah disimpan dari perangkat atau tab lain setelah kamu membuka dashboard ini. Pilih versi mana yang dipakai. "Pakai versi server" membuang perubahanmu di sini.
        </p>
      </Dialog>
    </div>
  )
}
