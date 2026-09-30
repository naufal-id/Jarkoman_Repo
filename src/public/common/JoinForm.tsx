import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { api, ApiError } from '../../shared/api'
import { gameDef, picksFor, roleOfPick } from '../../shared/games'
import { joinCloseLabel, joinClosed, neededRoles, slotOf } from '../../shared/joins'
import { KEYS, readJSON, removeKey, writeJSON } from '../../shared/storage'
import type { Jarkoman } from '../../shared/types'
import { buildJoinMessage, waLink } from '../../shared/wa'
import { usePage } from './context'
import { pageLink, type SessionInfo } from './hooks'

export interface PickerProps {
  value: string
  onChange: (value: string) => void
  options: string[]
  labelId: string
  role?: string
  /** Role yang masih kosong di skuad (petunjuk komposisi tim), untuk ditandai picker tema */
  needed?: string[]
}

/** 'joined' = langsung masuk skuad, 'wa' = pesan WhatsApp dibuka (pendaftaran langsung mati) */
export type SentKind = 'joined' | 'wa'

interface JoinFormProps {
  j: Jarkoman
  session: SessionInfo
  /** Teks tombol utama per tema */
  cta: ReactNode
  /** Picker kustom untuk role (misalnya ikon lane MLBB, swatch warna R.E.P.O.) */
  renderRole?: (p: PickerProps) => ReactNode
  /** Picker kustom untuk pick (misalnya buy menu CS2) */
  renderPick?: (p: PickerProps) => ReactNode
  onSent?: (kind: SentKind) => void
  className?: string
}

/** Bukti pendaftaran langsung yang disimpan di perangkat ini, per jarkoman. */
interface JoinedRecord {
  player: string
  key: string
  name: string
  /** Slot terakhir yang dilihat perangkat ini (null = cadangan), untuk memberi tahu saat naik dari cadangan */
  slot?: number | null
}

export function JoinForm({ j, session, cta, renderRole, renderPick, onSent, className = '' }: JoinFormProps) {
  const def = gameDef(j.game)
  const { preview, replaceItem } = usePage()
  const base = useId()
  const nameRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(() => readJSON<string>(KEYS.joinName(j.id)) ?? '')
  const [role, setRole] = useState('')
  const [pick, setPick] = useState('')
  const [note, setNote] = useState('')
  const [trap, setTrap] = useState('')
  const [error, setError] = useState('')
  const [failure, setFailure] = useState('')
  const [busy, setBusy] = useState(false)
  const [sentHref, setSentHref] = useState('')
  const [previewNote, setPreviewNote] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [joined, setJoined] = useState<JoinedRecord | null>(() => readJSON<JoinedRecord>(KEYS.joined(j.id)))
  const [editing, setEditing] = useState(false)
  const [editRole, setEditRole] = useState('')
  const [editPick, setEditPick] = useState('')
  const [promoted, setPromoted] = useState<number | null>(null)

  // Isi form selalu milik jarkoman yang sedang dibuka. Di preview admin, pindah jarkoman atau game
  // tidak boleh membawa nama, pilihan, atau status dari jarkoman sebelumnya.
  useEffect(() => {
    setName(readJSON<string>(KEYS.joinName(j.id)) ?? '')
    setJoined(readJSON<JoinedRecord>(KEYS.joined(j.id)))
    setRole('')
    setPick('')
    setNote('')
    setError('')
    setFailure('')
    setSentHref('')
    setPreviewNote(false)
    setConfirmLeave(false)
    setEditing(false)
    setPromoted(null)
  }, [j.id, j.game])

  // Naik dari cadangan: perangkat ini ingat slot terakhir yang dilihat. Kalau dulu cadangan dan sekarang punya
  // slot (ada yang batal), beri tahu sekali lalu simpan slot barunya.
  const mySlot = joined && j.players.some((p) => p.id === joined.player) ? slotOf(j, joined.player) : undefined
  useEffect(() => {
    if (!joined || mySlot === undefined || joined.slot === mySlot) return
    if (joined.slot === null && typeof mySlot === 'number') setPromoted(mySlot)
    const record = { ...joined, slot: mySlot }
    writeJSON(KEYS.joined(j.id), record)
    setJoined(record)
  }, [joined, mySlot, j.id])

  const closed = session.state === 'ended' || session.state === 'cancelled'
  const auto = j.autoJoin
  // Pendaftaran dianggap aktif hanya kalau pemainnya masih ada di skuad (host bisa saja menghapusnya).
  const me = joined ? j.players.find((p) => p.id === joined.player) : undefined

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

  // Batas pendaftaran dari host sudah lewat (yang sudah terdaftar tetap melihat status dan bisa batal ikut).
  if (joinClosed(j) && !(joined && j.players.some((p) => p.id === joined.player))) {
    const ask = waLink(j.wa, `Halo, pendaftaran jarkoman ${def.name} "${j.headline}" sudah ditutup. Masih bisa ikut atau jadi cadangan?`)
    return (
      <div className={`jf jf--closed ${className}`}>
        <p className="jf__closed-text">Pendaftaran sudah ditutup host {joinCloseLabel(j)}. Masih mau ikut? Tanya langsung ke host.</p>
        <a className="jf__submit" href={ask} target="_blank" rel="noopener noreferrer">
          Tanya host di WhatsApp
        </a>
      </div>
    )
  }

  const openWhatsApp = () => {
    const message = buildJoinMessage(j, { name, role, pick, note }, pageLink(j))
    const href = waLink(j.wa, message)
    const win = window.open(href, '_blank')
    if (win) win.opener = null
    setSentHref(href)
    onSent?.('wa')
  }

  if (me && joined) {
    const slot = slotOf(j, me.id)
    const reserveNo = j.players.indexOf(me) - j.slots + 1
    const detail = [me.role, me.pick].filter(Boolean).join(' · ')
    const tellHost = waLink(
      j.wa,
      `Halo, aku sudah lock in di jarkoman ${def.name} "${j.headline}" atas nama ${me.name}${slot ? ` (slot ${slot})` : ' (cadangan)'}.\n${pageLink(j)}`,
    )
    const startEdit = () => {
      setEditRole(me.role)
      setEditPick(me.pick)
      setFailure('')
      setEditing(true)
    }
    const saveEdit = async () => {
      setBusy(true)
      setFailure('')
      try {
        const res = await api.updateJoin({ id: j.id, player: joined.player, key: joined.key, role: editRole, pick: editPick })
        replaceItem(res.item)
        setEditing(false)
      } catch (err) {
        setFailure(err instanceof ApiError ? err.message : 'Gagal menyimpan perubahan. Coba lagi.')
      } finally {
        setBusy(false)
      }
    }
    const onEditPick = (value: string) => {
      setEditPick(value)
      const inferred = roleOfPick(def, value)
      if (inferred && !editRole) setEditRole(inferred)
    }
    const leave = async () => {
      setBusy(true)
      setFailure('')
      try {
        const res = await api.leave(j.id, joined.player, joined.key)
        removeKey(KEYS.joined(j.id))
        setJoined(null)
        setConfirmLeave(false)
        replaceItem(res.item)
      } catch (err) {
        setFailure(err instanceof ApiError ? err.message : 'Gagal membatalkan. Coba lagi.')
      } finally {
        setBusy(false)
      }
    }
    return (
      <div className={`jf jf--done ${className}`}>
        <div className="jf__done" role="status">
          <p className="jf__done-kicker">{promoted && slot ? `Naik dari cadangan · Slot ${slot} terkunci` : slot ? `Slot ${slot} terkunci` : `Cadangan ke-${reserveNo}`}</p>
          <p className="jf__done-name">{me.name}</p>
          <p className="jf__done-text">
            {detail ? `${detail}. ` : ''}
            {promoted && slot
              ? 'Ada yang batal, jadi kamu naik ke skuad. Kabari host kalau jadwalmu berubah.'
              : slot
                ? 'Nama kamu sudah tampil di skuad. Host tidak perlu memasukkanmu lagi.'
                : 'Skuad sudah penuh, jadi kamu masuk cadangan. Kalau ada yang batal, kamu naik otomatis.'}
          </p>
        </div>
        {editing && (
          <div className="jf__edit">
            <div className="jf__field jf__field--role" role="group" aria-labelledby={`${base}-erole`}>
              <span className="jf__label" id={`${base}-erole`}>
                {def.roleLabel}
              </span>
              {renderRole ? (
                renderRole({ value: editRole, onChange: setEditRole, options: def.roles, labelId: `${base}-erole`, needed: neededRoles(j) })
              ) : (
                <select className="jf__input" aria-labelledby={`${base}-erole`} value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                  <option value="">Bebas / belum tahu</option>
                  {def.roles.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="jf__field jf__field--pick" role="group" aria-labelledby={`${base}-epick`}>
              <span className="jf__label" id={`${base}-epick`}>
                {def.pickLabel}
              </span>
              {renderPick ? (
                renderPick({ value: editPick, onChange: onEditPick, options: picksFor(def, editRole), labelId: `${base}-epick`, role: editRole })
              ) : (
                <select className="jf__input" aria-labelledby={`${base}-epick`} value={editPick} onChange={(e) => onEditPick(e.target.value)}>
                  <option value="">Bebas / belum tahu</option>
                  {picksFor(def, editRole).map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}
        <div className="jf__foot">
          {editing ? (
            <>
              <button type="button" className="jf__submit" onClick={saveEdit} disabled={busy}>
                {busy ? 'Menyimpan…' : 'Simpan perubahan'}
              </button>
              <button type="button" className="jf__alt" onClick={() => setEditing(false)} disabled={busy}>
                Tidak jadi
              </button>
            </>
          ) : (
            <>
              <a className="jf__submit" href={tellHost} target="_blank" rel="noopener noreferrer">
                Kabari host di WhatsApp
              </a>
              <p className="jf__hint">Opsional. Slot kamu sudah tersimpan.</p>
              <button type="button" className="jf__alt" onClick={startEdit}>
                Ubah {def.roleLabel.toLowerCase()} atau {def.pickLabel.toLowerCase()}
              </button>
            </>
          )}
          {editing ? null : confirmLeave ? (
            <div className="jf__confirm">
              <span>Yakin batal ikut? Slotmu akan dibuka untuk orang lain.</span>
              <button type="button" className="jf__alt" onClick={leave} disabled={busy}>
                {busy ? 'Membatalkan…' : 'Ya, batal ikut'}
              </button>
              <button type="button" className="jf__alt" onClick={() => setConfirmLeave(false)} disabled={busy}>
                Tidak jadi
              </button>
            </div>
          ) : (
            <button type="button" className="jf__alt" onClick={() => setConfirmLeave(true)}>
              Batal ikut
            </button>
          )}
          {failure && (
            <p className="jf__error" role="alert">
              {failure}
            </p>
          )}
        </div>
      </div>
    )
  }

  const pickOptions = picksFor(def, role)
  const needed = neededRoles(j)
  const deadline = joinCloseLabel(j)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!name.trim()) {
      setError('Isi nama dulu, biar host tahu siapa yang join.')
      nameRef.current?.focus()
      return
    }
    setError('')
    setFailure('')
    writeJSON(KEYS.joinName(j.id), name.trim())
    if (!auto) {
      openWhatsApp()
      return
    }
    if (preview) {
      // Preview admin tidak menulis ke data asli.
      setPreviewNote(true)
      onSent?.('joined')
      return
    }
    setBusy(true)
    try {
      const res = await api.join({
        id: j.id,
        name: name.trim(),
        role,
        pick,
        note,
        website: trap,
      })
      const record: JoinedRecord = {
        player: res.player.id,
        key: res.key,
        name: res.player.name,
      }
      writeJSON(KEYS.joined(j.id), record)
      setJoined(record)
      replaceItem(res.item)
      onSent?.('joined')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'name-taken') {
        setError(err.message)
        nameRef.current?.focus()
      } else {
        setFailure(err instanceof ApiError ? err.message : 'Gagal terhubung. Coba lagi.')
      }
    } finally {
      setBusy(false)
    }
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
    <form className={`jf ${className}`} onSubmit={submit} noValidate aria-busy={busy || undefined}>
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
        {needed.length > 0 && (
          <p className="jf__need">
            Tim masih butuh <b>{needed.join(', ')}</b>
          </p>
        )}
        {renderRole ? (
          renderRole({
            value: role,
            onChange: setRole,
            options: def.roles,
            labelId: roleId,
            needed,
          })
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
          renderPick({
            value: pick,
            onChange: onPick,
            options: pickOptions,
            labelId: pickId,
            role,
          })
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
          maxLength={auto ? 120 : 200}
          rows={2}
          placeholder="Misalnya: telat 15 menit, bisa sampai jam 11"
        />
      </div>

      {/* Jebakan bot: tersembunyi dari pengunjung dan pembaca layar. */}
      <div className="jf__trap" aria-hidden="true">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
        </label>
      </div>

      <div className="jf__foot">
        <button type="submit" className="jf__submit" disabled={busy}>
          {busy ? 'Mengunci slot…' : cta}
        </button>
        <p className="jf__hint">
          {auto
            ? session.full
              ? 'Slot sudah penuh. Kamu langsung masuk daftar cadangan dan naik otomatis kalau ada yang batal.'
              : 'Nama kamu langsung masuk skuad di halaman ini. Host tidak perlu memasukkanmu lagi.'
            : `${session.full ? 'Slot sudah penuh, kamu akan masuk daftar cadangan. ' : ''}Tombol ini membuka WhatsApp dengan pesan yang sudah terisi. Tinggal tekan kirim.`}
          {deadline && ` Pendaftaran ditutup ${deadline}.`}
        </p>
        {previewNote && (
          <p className="jf__sent" role="status">
            Ini preview, jadi tidak ada yang disimpan. Di halaman asli, pemain langsung masuk skuad.
          </p>
        )}
        {failure && (
          <p className="jf__error" role="alert">
            {failure}{' '}
            <button type="button" className="jf__alt" onClick={openWhatsApp}>
              Konfirmasi lewat WhatsApp saja
            </button>
          </p>
        )}
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
