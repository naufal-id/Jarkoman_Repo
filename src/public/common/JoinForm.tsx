import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { gameDef, picksFor, roleOfPick } from '../../shared/games'
import { KEYS, readJSON, writeJSON } from '../../shared/storage'
import type { Jarkoman } from '../../shared/types'
import { buildJoinMessage, DEFAULT_WA, formatPhoneDisplay, waLink } from '../../shared/wa'
import { pageLink, type SessionInfo } from './hooks'

export interface PickerProps {
  value: string
  onChange: (value: string) => void
  options: string[]
  labelId: string
  role?: string
}

interface JoinFormProps {
  j: Jarkoman
  session: SessionInfo
  /** Teks tombol utama per tema */
  cta: ReactNode
  /** Picker kustom untuk role (misalnya ikon lane MLBB, swatch warna R.E.P.O.) */
  renderRole?: (p: PickerProps) => ReactNode
  /** Picker kustom untuk pick (misalnya buy menu CS2) */
  renderPick?: (p: PickerProps) => ReactNode
  onSent?: () => void
  className?: string
}

export function JoinForm({ j, session, cta, renderRole, renderPick, onSent, className = '' }: JoinFormProps) {
  const def = gameDef(j.game)
  const base = useId()
  const nameRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(() => readJSON<string>(KEYS.joinName) ?? '')
  const [role, setRole] = useState('')
  const [pick, setPick] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [sentHref, setSentHref] = useState('')

  // Pilihan role/pick harus ikut berubah kalau admin mengganti game saat preview.
  useEffect(() => {
    setRole('')
    setPick('')
    setSentHref('')
  }, [j.game])

  const closed = session.state === 'ended' || session.state === 'cancelled'
  const phone = formatPhoneDisplay(j.wa || DEFAULT_WA)

  if (closed) {
    const ask = waLink(j.wa, `Halo, jarkoman ${def.name} "${j.headline}" sudah ${session.state === 'cancelled' ? 'batal' : 'selesai'}. Ada jadwal mabar berikutnya?`)
    return (
      <div className={`jf jf--closed ${className}`}>
        <p className="jf__closed-text">
          {session.state === 'cancelled' ? 'Sesi ini dibatalkan host.' : 'Sesi ini sudah selesai.'} Mau ikut jadwal berikutnya? Tanya langsung ke host.
        </p>
        <a className="jf__submit" href={ask} target="_blank" rel="noopener noreferrer">
          Tanya jadwal berikutnya
        </a>
      </div>
    )
  }

  const pickOptions = picksFor(def, role)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Isi nama dulu, biar host tahu siapa yang join.')
      nameRef.current?.focus()
      return
    }
    setError('')
    writeJSON(KEYS.joinName, name.trim())
    const message = buildJoinMessage(j, { name, role, pick, note }, pageLink(j))
    const href = waLink(j.wa, message)
    const win = window.open(href, '_blank')
    if (win) win.opener = null
    setSentHref(href)
    onSent?.()
  }

  const onPick = (value: string) => {
    setPick(value)
    // Valorant: memilih agent otomatis mengisi role-nya.
    const inferred = roleOfPick(def, value)
    if (inferred && !role) setRole(inferred)
  }

  const roleId = `${base}-role`
  const pickId = `${base}-pick`

  return (
    <form className={`jf ${className}`} onSubmit={submit} noValidate>
      <div className="jf__field jf__field--name">
        <label className="jf__label" htmlFor={`${base}-name`}>
          Nama / nickname
        </label>
        <input
          ref={nameRef}
          id={`${base}-name`}
          className="jf__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={32}
          autoComplete="nickname"
          placeholder="Nama kamu di game"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${base}-err` : undefined}
          required
        />
        {error && (
          <p className="jf__error" id={`${base}-err`} role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="jf__field jf__field--role" role="group" aria-labelledby={roleId}>
        <span className="jf__label" id={roleId}>
          {def.roleLabel}
        </span>
        {renderRole ? (
          renderRole({ value: role, onChange: setRole, options: def.roles, labelId: roleId })
        ) : (
          <select className="jf__input" aria-labelledby={roleId} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Bebas / belum tahu</option>
            {def.roles.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        )}
      </div>

      <div className="jf__field jf__field--pick" role="group" aria-labelledby={pickId}>
        <span className="jf__label" id={pickId}>
          {def.pickLabel}
        </span>
        {renderPick ? (
          renderPick({ value: pick, onChange: onPick, options: pickOptions, labelId: pickId, role })
        ) : (
          <select className="jf__input" aria-labelledby={pickId} value={pick} onChange={(e) => onPick(e.target.value)}>
            <option value="">Bebas / belum tahu</option>
            {pickOptions.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        )}
      </div>

      <div className="jf__field jf__field--note">
        <label className="jf__label" htmlFor={`${base}-note`}>
          Catatan untuk host <span className="jf__opt">(opsional)</span>
        </label>
        <textarea
          id={`${base}-note`}
          className="jf__input jf__textarea"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          rows={2}
          placeholder="Misalnya: telat 15 menit, bisa sampai jam 11"
        />
      </div>

      <div className="jf__foot">
        <button type="submit" className="jf__submit">
          {cta}
        </button>
        <p className="jf__hint">
          {session.full ? 'Slot sudah penuh, kamu akan masuk daftar cadangan. ' : ''}
          Tombol ini membuka WhatsApp ke <strong>{phone}</strong> dengan pesan yang sudah terisi. Tinggal tekan kirim.
        </p>
        {sentHref && (
          <p className="jf__sent" role="status">
            WhatsApp tidak terbuka?{' '}
            <a href={sentHref} target="_blank" rel="noopener noreferrer">
              Buka pesan konfirmasi
            </a>
          </p>
        )}
      </div>
    </form>
  )
}
