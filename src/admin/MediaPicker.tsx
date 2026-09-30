import { useEffect, useState } from 'react'
import { api } from '../shared/api'
import { artThumb } from '../shared/art'
import { cleanUrl } from '../shared/sanitize'
import type { GameId, MediaPayload } from '../shared/types'

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; data: MediaPayload }

interface Props {
  game: GameId
  value: string
  onChange: (url: string) => void
}

/** Pilih latar: otomatis, dari galeri gambar resmi, atau URL sendiri. */
export function MediaPicker({ game, value, onChange }: Props) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [draftUrl, setDraftUrl] = useState(value)
  const [urlError, setUrlError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    setState({ kind: 'loading' })
    api
      .media(game)
      .then((data) => alive && setState({ kind: 'ready', data }))
      .catch(() => alive && setState({ kind: 'error' }))
    return () => {
      alive = false
    }
  }, [game, attempt])

  useEffect(() => setDraftUrl(value), [value])

  const applyUrl = () => {
    if (!draftUrl.trim()) {
      onChange('')
      setUrlError('')
      return
    }
    const clean = cleanUrl(draftUrl)
    if (!clean) {
      setUrlError('URL harus diawali https:// atau http://')
      return
    }
    setUrlError('')
    onChange(clean)
  }

  const gallery = state.kind === 'ready' ? state.data.gallery : []

  return (
    <div className="adm-media">
      <div className="adm-media__grid" role="radiogroup" aria-label="Pilihan gambar latar">
        <label className={`adm-media__opt ${value === '' ? 'is-on' : ''}`}>
          <input type="radio" name="bg" checked={value === ''} onChange={() => onChange('')} />
          <img src={artThumb(game)} alt="" loading="lazy" />
          <span className="adm-media__cap">Key art bawaan</span>
        </label>
        {state.kind === 'loading' && Array.from({ length: 3 }, (_, i) => <span className="adm-media__opt adm-media__opt--loading" key={i} aria-hidden="true" />)}
        {gallery.map((m) => (
          <label className={`adm-media__opt ${value === m.url ? 'is-on' : ''}`} key={m.url}>
            <input type="radio" name="bg" checked={value === m.url} onChange={() => onChange(m.url)} />
            <img src={m.thumb ?? m.url} alt="" loading="lazy" referrerPolicy="no-referrer" />
            <span className="adm-media__cap">{m.label}</span>
          </label>
        ))}
      </div>

      {state.kind === 'loading' && (
        <p className="adm-hint" role="status">
          Mengambil galeri gambar resmi…
        </p>
      )}
      {state.kind === 'error' && (
        <div className="adm-note adm-note--warn">
          <p>Galeri tambahan belum bisa dimuat (sumbernya sedang tidak bisa diakses dari server). Key art bawaan tetap dipakai, dan kamu bisa menempel URL gambar sendiri.</p>
          <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setAttempt((n) => n + 1)}>
            Coba muat lagi
          </button>
        </div>
      )}
      {state.kind === 'ready' && (
        <p className="adm-hint">
          Sumber: {state.data.source}. {gallery.length === 0 ? 'Tidak ada gambar yang tersedia saat ini.' : `${gallery.length} gambar tersedia.`}
        </p>
      )}

      <div className="adm-media__url">
        <label className="adm-label" htmlFor="bg-url">
          Atau pakai URL gambar sendiri
        </label>
        <div className="adm-inline">
          <input
            id="bg-url"
            className="adm-input"
            type="url"
            inputMode="url"
            placeholder="https://…/gambar.jpg"
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyUrl()
              }
            }}
            aria-invalid={urlError ? true : undefined}
            aria-describedby={urlError ? 'bg-url-err' : undefined}
          />
          <button type="button" className="adm-btn adm-btn--ghost" onClick={applyUrl}>
            Pakai
          </button>
        </div>
        {urlError && (
          <p className="adm-error" id="bg-url-err" role="alert">
            {urlError}
          </p>
        )}
      </div>
    </div>
  )
}
