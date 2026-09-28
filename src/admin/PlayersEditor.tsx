import { gameDef, picksFor } from '../shared/games'
import { uid } from '../shared/ids'
import type { Jarkoman, Player } from '../shared/types'

interface Props {
  item: Jarkoman
  onChange: (players: Player[]) => void
  onSlots: (slots: number) => void
}

export function PlayersEditor({ item, onChange, onSlots }: Props) {
  const def = gameDef(item.game)
  const players = item.players
  const inCount = players.filter((p) => p.status === 'in').length

  const update = (id: string, patch: Partial<Player>) => onChange(players.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const move = (index: number, dir: -1 | 1) => {
    const next = [...players]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }
  const add = () => {
    onChange([...players, { id: uid(), name: '', role: '', pick: '', status: 'in' }])
    // Fokus ke input nama baris baru setelah render.
    requestAnimationFrame(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('.adm-player__name')
      inputs[inputs.length - 1]?.focus()
    })
  }

  return (
    <div className="adm-players">
      <div className="adm-slots">
        <span className="adm-label" id="slots-label">
          Jumlah slot
        </span>
        <div className="adm-stepper" role="group" aria-labelledby="slots-label">
          <button type="button" className="adm-stepper__btn" onClick={() => onSlots(Math.max(1, item.slots - 1))} disabled={item.slots <= 1} aria-label="Kurangi slot">
            −
          </button>
          <output className="adm-stepper__value" aria-live="polite">
            {item.slots}
          </output>
          <button
            type="button"
            className="adm-stepper__btn"
            onClick={() => onSlots(Math.min(def.slotLimit, item.slots + 1))}
            disabled={item.slots >= def.slotLimit}
            aria-label="Tambah slot"
          >
            +
          </button>
        </div>
        <p className="adm-hint">
          {inCount}/{item.slots} sudah pasti masuk. Maksimal {def.slotLimit} untuk {def.name}. Pemain setelah urutan ke-{item.slots} tampil sebagai cadangan.
        </p>
      </div>

      {players.length === 0 ? (
        <div className="adm-empty">
          <p>Belum ada pemain. Tambahkan yang sudah konfirmasi lewat WhatsApp, atau biarkan kosong supaya semua slot terlihat terbuka.</p>
        </div>
      ) : (
        <ol className="adm-player-list">
          {players.map((p, i) => {
            const reserve = i >= item.slots
            const pickOptions = picksFor(def, p.role)
            return (
              <li className={`adm-player ${reserve ? 'is-reserve' : ''}`} key={p.id}>
                <span className="adm-player__num" aria-hidden="true">
                  {reserve ? 'C' : i + 1}
                </span>
                <input
                  className="adm-input adm-player__name"
                  value={p.name}
                  maxLength={32}
                  placeholder="Nama pemain"
                  aria-label={`Nama pemain ${i + 1}`}
                  aria-invalid={!p.name.trim() || undefined}
                  onChange={(e) => update(p.id, { name: e.target.value })}
                />
                <select className="adm-input" value={p.role} aria-label={`${def.roleLabel} pemain ${i + 1}`} onChange={(e) => update(p.id, { role: e.target.value })}>
                  <option value="">{def.roleLabel}: bebas</option>
                  {def.roles.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                  {p.role && !def.roles.includes(p.role) && <option>{p.role}</option>}
                </select>
                <input
                  className="adm-input"
                  value={p.pick}
                  maxLength={32}
                  list={`picks-${p.id}`}
                  placeholder={def.pickLabel}
                  aria-label={`${def.pickLabel} pemain ${i + 1}`}
                  onChange={(e) => update(p.id, { pick: e.target.value })}
                />
                <datalist id={`picks-${p.id}`}>
                  {pickOptions.map((o) => (
                    <option key={o} value={o} />
                  ))}
                </datalist>
                <button
                  type="button"
                  className={`adm-toggle ${p.status === 'in' ? 'is-on' : ''}`}
                  aria-pressed={p.status === 'in'}
                  onClick={() => update(p.id, { status: p.status === 'in' ? 'maybe' : 'in' })}
                >
                  {p.status === 'in' ? 'Pasti' : 'Belum pasti'}
                </button>
                <div className="adm-player__tools">
                  <button type="button" className="adm-icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Naikkan ${p.name || 'pemain'}`}>
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M5 12l5-5 5 5" />
                    </svg>
                  </button>
                  <button type="button" className="adm-icon-btn" onClick={() => move(i, 1)} disabled={i === players.length - 1} aria-label={`Turunkan ${p.name || 'pemain'}`}>
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M5 8l5 5 5-5" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="adm-icon-btn adm-icon-btn--danger"
                    onClick={() => onChange(players.filter((x) => x.id !== p.id))}
                    aria-label={`Hapus ${p.name || 'pemain'}`}
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M6 6l8 8M14 6l-8 8" />
                    </svg>
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      <button type="button" className="adm-btn adm-btn--ghost adm-players__add" onClick={add} disabled={players.length >= 20}>
        Tambah pemain
      </button>
      {players.some((p) => !p.name.trim()) && <p className="adm-hint adm-hint--warn">Baris tanpa nama tidak ikut tersimpan.</p>}
    </div>
  )
}
