import { useEffect, useState, type CSSProperties } from 'react'
import { GAMES, gameDef } from '../shared/games'
import { cleanUrl } from '../shared/sanitize'
import { liveState } from '../shared/time'
import { GAME_IDS, TZS } from '../shared/types'
import type { GameId, Jarkoman, ManualStatus, Tz } from '../shared/types'
import { DEFAULT_WA, formatPhoneDisplay, normalizePhone } from '../shared/wa'
import { ChoiceField, Counter, Field } from './fields'
import { MediaPicker } from './MediaPicker'
import { PlayersEditor } from './PlayersEditor'

interface EditorProps {
  item: Jarkoman
  onPatch: (patch: Partial<Jarkoman>) => void
  onGame: (game: GameId) => void
}

const AUTO_STATUS: Record<ReturnType<typeof liveState>, string> = {
  upcoming: 'Akan datang: hitung mundur berjalan',
  live: 'Sedang main (sesuai jam mulai dan selesai)',
  ended: 'Sudah lewat jam selesai',
  cancelled: 'Dibatalkan',
  unscheduled: 'Tanggal atau jam belum valid',
}

export function Editor({ item, onPatch, onGame }: EditorProps) {
  const def = gameDef(item.game)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const waIntl = normalizePhone(item.wa)
  const voiceBad = item.voice.trim() !== '' && !cleanUrl(item.voice)

  return (
    <div className="adm-editor__form">
      <section className="adm-sec" aria-labelledby="sec-game">
        <h2 className="adm-sec__title" id="sec-game">
          Game
        </h2>
        <div className="adm-games" role="radiogroup" aria-labelledby="sec-game">
          {GAME_IDS.map((g) => (
            <label key={g} className={`adm-game ${item.game === g ? 'is-on' : ''}`} data-game={g} style={{ '--acc': GAMES[g].accent } as CSSProperties}>
              <input type="radio" name="game" value={g} checked={item.game === g} onChange={() => onGame(g)} />
              <span className="adm-game__name">{GAMES[g].name}</span>
              <span className="adm-game__pub">{GAMES[g].publisher}</span>
            </label>
          ))}
        </div>
        <p className="adm-hint">Ganti game mengubah seluruh tampilan halaman: font, warna, animasi, dan pilihan mode, map, rank, serta role.</p>

        <div className="adm-field">
          <span className="adm-label" id="variant-label">
            Varian tema
          </span>
          <div className="adm-seg" role="radiogroup" aria-labelledby="variant-label">
            {def.variants.map((v) => (
              <label key={v.id} className={`adm-seg__opt ${item.variant === v.id ? 'is-on' : ''}`}>
                <input type="radio" name="variant" value={v.id} checked={item.variant === v.id} onChange={() => onPatch({ variant: v.id })} />
                <span>{v.label}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="adm-sec" aria-labelledby="sec-copy">
        <h2 className="adm-sec__title" id="sec-copy">
          Judul ajakan
        </h2>
        <Field label="Judul besar" htmlFor="f-headline" hint={<Counter value={item.headline} max={60} />}>
          <input id="f-headline" className="adm-input adm-input--lg" value={item.headline} maxLength={60} onChange={(e) => onPatch({ headline: e.target.value })} />
        </Field>
        <Field label="Kalimat pendek di bawah judul" htmlFor="f-subline" hint={<Counter value={item.subline} max={160} />}>
          <textarea id="f-subline" className="adm-input" rows={2} value={item.subline} maxLength={160} onChange={(e) => onPatch({ subline: e.target.value })} />
        </Field>
      </section>

      <section className="adm-sec" aria-labelledby="sec-time">
        <h2 className="adm-sec__title" id="sec-time">
          Jadwal
        </h2>
        <div className="adm-grid">
          <Field label="Tanggal" htmlFor="f-date">
            <input id="f-date" className="adm-input" type="date" value={item.date} onChange={(e) => e.target.value && onPatch({ date: e.target.value })} required />
          </Field>
          <Field label="Zona waktu" htmlFor="f-tz">
            <select id="f-tz" className="adm-input" value={item.tz} onChange={(e) => onPatch({ tz: e.target.value as Tz })}>
              {TZS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Jam mulai" htmlFor="f-time">
            <input id="f-time" className="adm-input" type="time" value={item.time} onChange={(e) => e.target.value && onPatch({ time: e.target.value })} required />
          </Field>
          <Field label="Jam selesai" htmlFor="f-end" hint="Kosongkan kalau belum tahu (dihitung 3 jam).">
            <div className="adm-inline">
              <input id="f-end" className="adm-input" type="time" value={item.endTime} onChange={(e) => onPatch({ endTime: e.target.value })} />
              {item.endTime && (
                <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => onPatch({ endTime: '' })}>
                  Kosongkan
                </button>
              )}
            </div>
          </Field>
        </div>
        <div className="adm-field">
          <span className="adm-label" id="status-label">
            Status
          </span>
          <div className="adm-seg" role="radiogroup" aria-labelledby="status-label">
            {(
              [
                ['open', 'Buka'],
                ['cancelled', 'Dibatalkan'],
                ['done', 'Selesai'],
              ] as [ManualStatus, string][]
            ).map(([v, label]) => (
              <label key={v} className={`adm-seg__opt ${item.status === v ? 'is-on' : ''}`}>
                <input type="radio" name="status" value={v} checked={item.status === v} onChange={() => onPatch({ status: v })} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <p className="adm-hint">Status di halaman sekarang: {AUTO_STATUS[liveState(item, now)]}.</p>
        </div>
      </section>

      <section className="adm-sec" aria-labelledby="sec-match">
        <h2 className="adm-sec__title" id="sec-match">
          Detail match
        </h2>
        <div className="adm-grid">
          <ChoiceField label="Mode" value={item.mode} options={def.modes} onChange={(v) => onPatch({ mode: v })} />
          <ChoiceField label={def.mapLabel} value={item.map} options={def.maps} onChange={(v) => onPatch({ map: v })} allowEmpty="Tidak ditentukan" />
          <ChoiceField label={def.rankLabel} value={item.rank} options={def.ranks} onChange={(v) => onPatch({ rank: v })} allowEmpty="Tidak ditentukan" />
          <Field label="Nama host" htmlFor="f-host" hint="Kalau sama dengan nama pemain, kartunya diberi tanda Host.">
            <input id="f-host" className="adm-input" value={item.host} maxLength={40} onChange={(e) => onPatch({ host: e.target.value })} placeholder="Nama kamu" />
          </Field>
          <Field label={def.lobbyLabel} htmlFor="f-lobby">
            <input id="f-lobby" className="adm-input" value={item.lobby} maxLength={120} onChange={(e) => onPatch({ lobby: e.target.value })} placeholder={def.lobbyPlaceholder} />
          </Field>
          <Field
            label="Link voice (Discord, dll)"
            htmlFor="f-voice"
            hint={voiceBad ? <span className="adm-hint--warn">Link belum valid, tidak akan disimpan. Harus diawali https://</span> : 'Opsional. Harus diawali https://'}
          >
            <input
              id="f-voice"
              className="adm-input"
              type="url"
              inputMode="url"
              value={item.voice}
              maxLength={600}
              onChange={(e) => onPatch({ voice: e.target.value })}
              placeholder="https://discord.gg/…"
              aria-invalid={voiceBad || undefined}
            />
          </Field>
        </div>
      </section>

      <section className="adm-sec" aria-labelledby="sec-squad">
        <h2 className="adm-sec__title" id="sec-squad">
          Skuad
        </h2>
        <PlayersEditor item={item} onChange={(players) => onPatch({ players })} onSlots={(slots) => onPatch({ slots })} />
      </section>

      <section className="adm-sec" aria-labelledby="sec-notes">
        <h2 className="adm-sec__title" id="sec-notes">
          Catatan / aturan
        </h2>
        <Field label="Satu aturan per baris" htmlFor="f-notes" hint={<Counter value={item.notes} max={1500} />}>
          <textarea
            id="f-notes"
            className="adm-input"
            rows={5}
            maxLength={1500}
            value={item.notes}
            onChange={(e) => onPatch({ notes: e.target.value })}
            placeholder={'Contoh:\nWajib pakai voice\nTelat 15 menit, slot dikasih ke cadangan'}
          />
        </Field>
      </section>

      <section className="adm-sec" aria-labelledby="sec-contact">
        <h2 className="adm-sec__title" id="sec-contact">
          Konfirmasi WhatsApp
        </h2>
        <Field
          label="Nomor WhatsApp tujuan"
          htmlFor="f-wa"
          hint={
            waIntl.length >= 10 ? (
              <>
                Pemain diarahkan ke <code>wa.me/{waIntl}</code> ({formatPhoneDisplay(item.wa)}).
              </>
            ) : (
              'Nomor terlalu pendek. Kalau tidak valid, nomor default yang dipakai.'
            )
          }
        >
          <div className="adm-inline">
            <input id="f-wa" className="adm-input" type="tel" inputMode="tel" value={item.wa} maxLength={20} onChange={(e) => onPatch({ wa: e.target.value })} />
            {normalizePhone(item.wa) !== normalizePhone(DEFAULT_WA) && (
              <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => onPatch({ wa: DEFAULT_WA })}>
                Pakai {formatPhoneDisplay(DEFAULT_WA)}
              </button>
            )}
          </div>
        </Field>
      </section>

      <section className="adm-sec" aria-labelledby="sec-bg">
        <h2 className="adm-sec__title" id="sec-bg">
          Gambar latar
        </h2>
        <MediaPicker game={item.game} value={item.bg} onChange={(bg) => onPatch({ bg })} />
      </section>
    </div>
  )
}
