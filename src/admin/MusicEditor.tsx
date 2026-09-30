import { useState } from 'react'
import { api, ApiError, audioType } from '../shared/api'
import { GAMES } from '../shared/games'
import { cleanUrl } from '../shared/sanitize'
import type { Jarkoman } from '../shared/types'
import { SONG_TITLES } from '../public/audio/procedural'
import { trackFor } from '../public/audio/tracks'
import { useMusic } from '../public/common/Music'
import { Field } from './fields'

type Mode = 'gen' | 'upload' | 'link' | 'none'

const MAX_BYTES = 4.5 * 1024 * 1024

function modeOf(music: string): Mode {
  if (music === 'none') return 'none'
  if (!music) return 'gen'
  return music.startsWith('/api/audio') ? 'upload' : 'link'
}

const OPTIONS: [Mode, string][] = [
  ['gen', 'Musik bawaan'],
  ['upload', 'Upload lagu'],
  ['link', 'Link audio'],
  ['none', 'Tanpa musik'],
]

interface Props {
  item: Jarkoman
  token: string
  onPatch: (patch: Partial<Jarkoman>) => void
}

export function MusicEditor({ item, token, onPatch }: Props) {
  const current = modeOf(item.music)
  const [mode, setMode] = useState<Mode>(current)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [link, setLink] = useState(current === 'link' ? item.music : '')
  const preview = useMusic(item, { autoResume: false })
  const track = trackFor(item.game)

  const choose = (m: Mode) => {
    setMode(m)
    setError('')
    if (m === 'gen') onPatch({ music: '' })
    if (m === 'none') onPatch({ music: 'none' })
    // Upload dan link: musik lama tetap dipakai sampai file/link baru valid.
  }

  const upload = async (file: File) => {
    if (!audioType(file).startsWith('audio/')) {
      setError('Pilih file audio: MP3, M4A, OGG, WAV, atau FLAC.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('File terlalu besar. Maksimal 4,5 MB (kira-kira 4 menit MP3 128 kbps).')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await api.uploadAudio(file, token)
      onPatch({ music: res.url, musicLabel: item.musicLabel || file.name.replace(/\.[^.]+$/, '').slice(0, 60) })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload gagal. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  const applyLink = () => {
    const clean = cleanUrl(link)
    if (!clean) {
      setError('Link harus diawali https:// dan mengarah langsung ke file audio.')
      return
    }
    setError('')
    onPatch({ music: clean })
  }

  return (
    <div className="adm-music">
      <div className="adm-seg" role="radiogroup" aria-labelledby="sec-music">
        {OPTIONS.map(([m, label]) => (
          <label key={m} className={`adm-seg__opt ${mode === m ? 'is-on' : ''}`}>
            <input type="radio" name="music-mode" checked={mode === m} onChange={() => choose(m)} />
            <span>{label}</span>
          </label>
        ))}
      </div>

      {mode === 'gen' &&
        (track ? (
          <p className="adm-hint">
            Lagu bawaan {GAMES[item.game].name}: "{track.title}" ({track.artist}). Diputar berulang dengan sambungan halus, dan ikut berganti kalau game diganti.
          </p>
        ) : (
          <p className="adm-hint">
            {GAMES[item.game].name} belum punya lagu bawaan, jadi dipakai musik sintetis "{SONG_TITLES[item.game]}" yang dibuat langsung di browser. Pilih Upload lagu kalau mau
            pakai lagu lain.
          </p>
        ))}

      {mode === 'upload' && (
        <div className="adm-field">
          <label className="adm-label" htmlFor="music-file">
            File lagu (maksimal 4,5 MB)
          </label>
          <input
            id="music-file"
            className="adm-input"
            type="file"
            accept="audio/*,.mp3,.m4a,.ogg,.wav,.flac"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) upload(f)
              e.target.value = ''
            }}
          />
          {busy && (
            <p className="adm-hint" role="status">
              Mengunggah lagu…
            </p>
          )}
          {current === 'upload' && !busy && <p className="adm-hint">Lagu sudah tersimpan di server. Pilih file lain untuk menggantinya.</p>}
          <p className="adm-hint">Pakai lagu yang boleh kamu gunakan. Lagu lama yang tidak dipakai lagi dihapus otomatis setelah 24 jam.</p>
        </div>
      )}

      {mode === 'link' && (
        <Field label="Link langsung ke file audio" htmlFor="music-link" hint="Contoh: https://…/lagu.mp3. Link YouTube atau Spotify tidak bisa diputar sebagai musik latar.">
          <div className="adm-inline">
            <input
              id="music-link"
              className="adm-input"
              type="url"
              inputMode="url"
              placeholder="https://…/lagu.mp3"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  applyLink()
                }
              }}
            />
            <button type="button" className="adm-btn adm-btn--ghost" onClick={applyLink}>
              Pakai
            </button>
          </div>
        </Field>
      )}

      {(mode === 'upload' || mode === 'link') && (
        <Field label="Judul lagu (tampil saat diputar)" htmlFor="music-label">
          <input
            id="music-label"
            className="adm-input"
            maxLength={60}
            value={item.musicLabel}
            placeholder="Misalnya: Tema menu utama"
            onChange={(e) => onPatch({ musicLabel: e.target.value })}
          />
        </Field>
      )}

      {error && (
        <p className="adm-error" role="alert">
          {error}
        </p>
      )}

      {mode !== 'none' && mode === current && (
        <div className="adm-inline adm-music__try">
          <button type="button" className="adm-btn adm-btn--ghost" onClick={preview.toggle} aria-pressed={preview.playing} disabled={preview.busy}>
            {preview.busy ? 'Memuat…' : preview.playing ? 'Hentikan' : 'Coba dengar'}
          </button>
          {preview.error && <span className="adm-error">{preview.error}</span>}
        </div>
      )}

      <p className="adm-hint">Musik tidak berbunyi sendiri. Pengunjung menyalakannya lewat tombol musik di kiri bawah halaman.</p>
    </div>
  )
}
