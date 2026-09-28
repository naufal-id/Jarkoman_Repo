import { useCallback, useEffect, useRef, useState } from 'react'
import { KEYS, readJSON, writeJSON } from '../../shared/storage'
import type { GameId, Jarkoman } from '../../shared/types'
import { getContext, startFile } from '../audio/player'
import { SONG_TITLES, startSong, type Playback } from '../audio/procedural'
import { usePage } from './context'

export type MusicSource = { kind: 'gen'; game: GameId } | { kind: 'file'; url: string } | { kind: 'none' }

export function musicSource(j: Pick<Jarkoman, 'music' | 'game'>): MusicSource {
  if (j.music === 'none') return { kind: 'none' }
  if (j.music) return { kind: 'file', url: j.music }
  return { kind: 'gen', game: j.game }
}

export function musicLabel(j: Pick<Jarkoman, 'music' | 'game' | 'musicLabel'>): string {
  const src = musicSource(j)
  if (src.kind === 'gen') return `"${SONG_TITLES[src.game]}", musik bawaan`
  if (src.kind === 'file') return j.musicLabel || 'Lagu pilihan host'
  return ''
}

/**
 * Pemutar musik: tidak pernah menyala sendiri tanpa aksi pengunjung (browser juga memblokirnya).
 * Pilihan "nyala" diingat; di kunjungan berikutnya musik lanjut setelah interaksi pertama.
 */
export function useMusic(j: Pick<Jarkoman, 'music' | 'game'>, opts: { autoResume: boolean }) {
  const source = musicSource(j)
  const key = source.kind === 'gen' ? `gen:${source.game}` : source.kind === 'file' ? source.url : 'none'
  const [playing, setPlaying] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const handle = useRef<Playback | null>(null)
  const wanted = useRef(false)
  const sourceRef = useRef(source)
  sourceRef.current = source
  const keyRef = useRef(key)

  const halt = () => {
    handle.current?.stop()
    handle.current = null
  }

  const begin = useCallback(async (src: MusicSource) => {
    halt()
    if (src.kind === 'none') {
      setPlaying(false)
      return
    }
    setBusy(true)
    setError('')
    try {
      const h = src.kind === 'gen' ? startSong(await getContext(), src.game) : await startFile(src.url)
      if (!wanted.current) {
        h.stop()
        return
      }
      handle.current = h
      setPlaying(true)
    } catch {
      wanted.current = false
      setPlaying(false)
      setError(src.kind === 'file' ? 'Lagu gagal diputar. Cek file atau link-nya.' : 'Browser ini tidak bisa memutar musik.')
    } finally {
      setBusy(false)
    }
  }, [])

  const toggle = useCallback(() => {
    if (wanted.current) {
      wanted.current = false
      halt()
      setPlaying(false)
      writeJSON(KEYS.music, 'off')
    } else {
      wanted.current = true
      writeJSON(KEYS.music, 'on')
      begin(sourceRef.current)
    }
  }, [begin])

  // Sumber berganti (misalnya admin mengganti game di preview): lanjut dengan sumber baru kalau sedang menyala.
  useEffect(() => {
    if (keyRef.current === key) return
    keyRef.current = key
    if (wanted.current) begin(sourceRef.current)
  }, [key, begin])

  // Tab disembunyikan: berhenti. Tab kembali: lanjut kalau sebelumnya menyala.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        halt()
        setPlaying(false)
      } else if (wanted.current) {
        begin(sourceRef.current)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [begin])

  useEffect(() => {
    if (!opts.autoResume || readJSON<string>(KEYS.music) !== 'on') return
    const go = (e: Event) => {
      if ((e.target as Element | null)?.closest?.('.music')) return
      cleanup()
      if (!wanted.current) {
        wanted.current = true
        begin(sourceRef.current)
      }
    }
    const cleanup = () => {
      window.removeEventListener('pointerdown', go)
      window.removeEventListener('keydown', go)
    }
    window.addEventListener('pointerdown', go)
    window.addEventListener('keydown', go)
    return cleanup
  }, [opts.autoResume, begin])

  useEffect(
    () => () => {
      wanted.current = false
      halt()
    },
    [],
  )

  return { playing, busy, error, toggle, available: source.kind !== 'none' }
}

/** Tombol musik mengambang di kiri bawah. Tampilannya diatur tiap tema lewat kelas .music. */
export function MusicDock({ j }: { j: Jarkoman }) {
  const { preview } = usePage()
  const m = useMusic(j, { autoResume: !preview })
  // Judul lagu tampil sebentar saat mulai, lalu hilang supaya tidak menutupi konten di layar kecil.
  const [showNow, setShowNow] = useState(false)
  useEffect(() => {
    if (!m.playing) {
      setShowNow(false)
      return
    }
    setShowNow(true)
    const t = window.setTimeout(() => setShowNow(false), 5000)
    return () => window.clearTimeout(t)
  }, [m.playing, j.music, j.game])
  if (!m.available) return null
  return (
    <div className="music" data-playing={m.playing || undefined}>
      <button
        type="button"
        className="music__btn"
        aria-pressed={m.playing}
        aria-label={m.playing ? 'Matikan musik' : 'Putar musik'}
        onClick={m.toggle}
        disabled={m.busy}
      >
        <span className="music__eq" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="music__text">{m.busy ? 'Memuat…' : m.playing ? 'Musik nyala' : 'Putar musik'}</span>
      </button>
      {m.playing && showNow && <p className="music__now">{musicLabel(j)}</p>}
      {m.error && (
        <p className="music__now music__now--err" role="status">
          {m.error}
        </p>
      )}
    </div>
  )
}
