import '@fontsource/saira-condensed/700.css'
import '@fontsource/saira-condensed/800.css'
import '@fontsource/rajdhani/500.css'
import '@fontsource/rajdhani/600.css'
import '@fontsource/rajdhani/700.css'
import '@fontsource/noto-sans/400.css'
import '@fontsource/noto-sans/600.css'
import '@fontsource/noto-sans/700.css'
import './cs2.css'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { gameDef } from '../../../shared/games'
import { dayName, formatClock, formatDateShort, pad2 } from '../../../shared/time'
import type { Player } from '../../../shared/types'
import { copyText } from '../../common/actions'
import { HERO_SIZES } from '../../../shared/art'
import { ArtImage } from '../../common/ArtImage'
import { usePage, type ThemeProps } from '../../common/context'
import { Digits } from '../../common/Digits'
import { Schedule, SiteFooter, useActions } from '../../common/Extras'
import { gsap, MOTION_OK, ScrollTrigger, useGSAP } from '../../common/gsap'
import { isClosed, joinTitle, statusLabel, useSession, useSquadMarks, type SessionInfo } from '../../common/hooks'
import { useIntroGate } from '../../common/intro'
import { JoinForm, type SentKind } from '../../common/JoinForm'
import { MusicDock } from '../../common/Music'
import { Split } from '../../common/Split'
import { useToast } from '../../common/Toast'
import { CS2_MAPS, type Cs2Map, type MapPoint } from './maps'

const def = gameDef('cs2')

/** Kelas senjata, sisi yang bisa membelinya (T saja, CT saja, atau dua-duanya), dan harga di buy menu CS2. */
const WEAPONS: Record<string, { kind: string; side: 'T' | 'CT' | ''; price: number }> = {
  'AK-47': { kind: 'Rifle', side: 'T', price: 2700 },
  M4A4: { kind: 'Rifle', side: 'CT', price: 3100 },
  'M4A1-S': { kind: 'Rifle', side: 'CT', price: 2900 },
  AWP: { kind: 'Sniper', side: '', price: 4750 },
  'Desert Eagle': { kind: 'Pistol', side: '', price: 700 },
  'Galil AR': { kind: 'Rifle', side: 'T', price: 1800 },
  FAMAS: { kind: 'Rifle', side: 'CT', price: 2050 },
  'SSG 08': { kind: 'Sniper', side: '', price: 1700 },
  MP9: { kind: 'SMG', side: 'CT', price: 1250 },
  'MAC-10': { kind: 'SMG', side: 'T', price: 1050 },
  P90: { kind: 'SMG', side: '', price: 2350 },
  Nova: { kind: 'Heavy', side: '', price: 1050 },
  'USP-S': { kind: 'Pistol', side: 'CT', price: 200 },
  'Glock-18': { kind: 'Pistol', side: 'T', price: 200 },
}

/** Warna pemain CS2 (kuning, ungu, hijau, biru, oranye) dipakai berurutan per slot, di radar dan scoreboard. */
const pc = (slot: number) => String(slot % 5)

/** Kurang lebih pola recoil AK-47 (naik, ke kiri, lalu ke kanan) dalam kotak 120 x 220. */
// prettier-ignore
const SPRAY: [number, number][] = [
  [60, 212], [61, 198], [59, 182], [62, 164], [60, 145], [63, 126], [66, 108], [68, 92], [70, 78], [71, 66],
  [64, 57], [53, 52], [42, 49], [32, 46], [25, 47], [20, 42], [29, 37], [41, 35], [55, 34], [69, 31],
  [83, 29], [95, 31], [103, 27], [97, 22],
]

export default function Cs2Page({ j }: ThemeProps) {
  const { preview, others, replay, media } = usePage()
  const s = useSession(j)
  const marks = useSquadMarks(j)
  // Pemain yang disorot kursor di scoreboard atau di radar: baris dan titiknya menyala bersamaan.
  const [hot, setHot] = useState<string | null>(null)
  const intro = useIntroGate('cs2', preview, replay)
  const actions = useActions(j)
  const toast = useToast()
  const root = useRef<HTMLDivElement>(null)
  const [readyKey, setReadyKey] = useState(0)
  const [sentKind, setSentKind] = useState<SentKind>('joined')
  // Pilihan di form dicerminkan ke kartu loadout di kolom kiri buy menu.
  const [loadout, setLoadout] = useState<{ role: string; pick: string }>({ role: '', pick: '' })
  const mirrorRole = useCallback((role: string) => setLoadout((l) => (l.role === role ? l : { ...l, role })), [])
  const mirrorPick = useCallback((pick: string) => setLoadout((l) => (l.pick === pick ? l : { ...l, pick })), [])

  // Huruf bombsite hanya "diklaim" kalau judul memang menyebut site A atau B.
  const named = /\bA\b/.test(j.headline.toUpperCase()) ? 'A' : /\bB\b/.test(j.headline.toUpperCase()) ? 'B' : null
  const known = CS2_MAPS[j.map]
  // de_ = bomb defusal, cs_ = hostage rescue. Map di luar daftar ditulis ulang seperti nama file map.
  const mapCode = known?.code ?? (j.map ? j.map.toLowerCase().replace(/\s+/g, '_') : '')
  const scale = j.headline.length <= 14 ? 1 : j.headline.length <= 24 ? 0.8 : 0.64
  const slots = Array.from({ length: j.slots }, (_, i) => j.players[i] ?? null)
  const reserves = j.players.slice(j.slots)
  const joined = j.players.filter((p) => p.status === 'in')

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MOTION_OK, () => {
        if (!intro.ready) return
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
        tl.from('.cs-hud-top', { y: -70, opacity: 0, duration: 0.6 }, 0)
          .from('.cs-hud--left', { x: -80, opacity: 0, duration: 0.7 }, 0.15)
          .from('.cs-hud--right', { x: 80, opacity: 0, duration: 0.7 }, 0.15)
          .from('.cs-screen', { x: 70, filter: 'brightness(0.2)', duration: 0.8, ease: 'power4.out' }, 0.1)
          .from('.cs-screen__tag', { opacity: 0, y: -10, duration: 0.4 }, 0.6)
          .from('.cs-hero__title .split-word', { y: 60, opacity: 0, duration: 0.6, stagger: 0.08 }, 0.2)
          .from('.cs-kicker, .cs-hero__sub', { opacity: 0, x: -24, duration: 0.5, stagger: 0.08 }, 0.35)
          .from('.cs-hero__cta > *', { opacity: 0, y: 20, duration: 0.45, stagger: 0.07 }, 0.55)

        // Tembakan: titik muncul satu per satu, judul "kena recoil" sedikit tiap tembakan.
        const dots = gsap.utils.toArray<SVGElement>('.cs-spray__dot')
        const spray = gsap.timeline({ delay: 0.9 })
        dots.forEach((dot, i) => {
          spray.from(dot, { scale: 0, transformOrigin: '50% 50%', opacity: 0, duration: 0.08 }, i * 0.075)
          if (i % 3 === 0) spray.to('.cs-hero__title', { y: -3, duration: 0.03, yoyo: true, repeat: 1 }, i * 0.075)
        })

        // Overview resmi untuk map dalam daftar, radar ilustrasi untuk map lain: animasikan yang ada saja.
        if (root.current?.querySelector('.cs-map')) {
          gsap.from('.cs-map__img', {
            scrollTrigger: { trigger: '.cs-map', start: 'top 80%', once: true },
            opacity: 0,
            scale: 1.06,
            duration: 0.9,
            ease: 'power3.out',
          })
          gsap.from('.cs-map__spawn, .cs-map__site', {
            scrollTrigger: { trigger: '.cs-map', start: 'top 70%', once: true },
            scale: 0,
            opacity: 0,
            duration: 0.4,
            stagger: 0.08,
            delay: 0.35,
            ease: 'back.out(2.2)',
          })
          if (root.current.querySelector('.cs-map__player')) {
            gsap.from('.cs-map__player', {
              scrollTrigger: { trigger: '.cs-map', start: 'top 70%', once: true },
              scale: 0,
              duration: 0.3,
              stagger: 0.05,
              delay: 0.8,
              ease: 'back.out(3)',
            })
          }
          // Denyut site target baru mulai saat radar terlihat (lihat .cs-map.is-seen di CSS).
          ScrollTrigger.create({
            trigger: '.cs-map',
            start: 'top 70%',
            once: true,
            onEnter: () => root.current?.querySelector('.cs-map')?.classList.add('is-seen'),
          })
          gsap.from('.cs-mapcard', {
            scrollTrigger: { trigger: '.cs-mapcard', start: 'top 85%', once: true },
            clipPath: 'inset(0 100% 0 0)',
            duration: 0.8,
            ease: 'power3.inOut',
          })
        } else {
          gsap.from('.cs-radar__sweep', {
            rotate: -720,
            transformOrigin: '50% 50%',
            duration: 3.2,
            ease: 'power2.out',
            scrollTrigger: { trigger: '.cs-radar', start: 'top 85%', once: true },
          })
        }
        gsap.from('.cs-info__row', {
          scrollTrigger: { trigger: '.cs-info__list', start: 'top 85%', once: true },
          x: -40,
          opacity: 0,
          duration: 0.5,
          stagger: 0.07,
        })
        gsap.from('.cs-board__row', {
          scrollTrigger: { trigger: '.cs-board__table', start: 'top 85%', once: true },
          opacity: 0,
          x: -30,
          duration: 0.45,
          stagger: 0.06,
        })
        gsap.from('.cs-feed__item', {
          scrollTrigger: { trigger: '.cs-feed', start: 'top 90%', once: true },
          x: 120,
          opacity: 0,
          duration: 0.5,
          stagger: 0.18,
          ease: 'back.out(1.4)',
        })
        gsap.utils.toArray<HTMLElement>('.cs-title').forEach((el) => {
          gsap.from(el, { scrollTrigger: { trigger: el, start: 'top 88%', once: true }, clipPath: 'inset(0 100% 0 0)', duration: 0.7, ease: 'power3.inOut' })
        })
      })
    },
    { scope: root, dependencies: [intro.ready, replay], revertOnUpdate: true },
  )

  // Setelah konfirmasi: layar ACCEPT seperti saat match ditemukan. Kotak pemain menyala hijau satu per satu,
  // lalu tombol ACCEPT berdenyut sekali. Tidak dijalankan saat reduced motion (status tetap ada di form).
  useGSAP(
    () => {
      if (!readyKey) return
      gsap.matchMedia().add(MOTION_OK, () => {
        gsap
          .timeline()
          .fromTo('.cs-accept', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 })
          .fromTo('.cs-accept__panel', { scale: 0.92, y: 16 }, { scale: 1, y: 0, duration: 0.35, ease: 'back.out(1.8)' }, 0)
          .from('.cs-accept__slot.is-in', { scale: 0.5, opacity: 0.15, duration: 0.18, stagger: 0.12, ease: 'back.out(3)' }, 0.3)
          .fromTo('.cs-accept__btn', { scale: 1 }, { scale: 1.06, duration: 0.16, yoyo: true, repeat: 1, ease: 'power2.out' }, '>-0.05')
          .to('.cs-accept', { autoAlpha: 0, duration: 0.35, delay: 0.9 })
      })
    },
    { scope: root, dependencies: [readyKey] },
  )

  const copyLobby = async () => toast((await copyText(j.lobby)) ? `${def.lobbyLabel} disalin.` : 'Gagal menyalin.')

  return (
    <div className="cs" data-variant={j.variant} data-site={named ?? undefined} ref={root} style={known?.tint ? ({ '--map-tint': known.tint } as CSSProperties) : undefined}>
      {intro.show && <CsIntro onDone={intro.done} />}

      <header className="cs-hud-top">
        <a className="cs-hud-top__mark" href="#main" aria-label="Jarkoman, ke atas">
          JARKOMAN
        </a>
        <div className="cs-score" aria-label={`${s.filled} dari ${j.slots} slot terisi`}>
          <span className="cs-score__side">
            <b>{s.filled}</b>
            <small>masuk</small>
          </span>
          <RoundTimer s={s} />
          <span className="cs-score__side cs-score__side--right">
            <b>{j.slots}</b>
            <small>slot</small>
          </span>
        </div>
        <div className="cs-hud-top__right">
          <span className={`cs-status cs-status--${s.state}`}>{statusLabel(s)}</span>
          <button className="cs-btn cs-btn--line cs-btn--sm cs-share" type="button" onClick={actions.share} aria-label="Bagikan">
            <svg className="cs-share__ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3v12M7 8l5-5 5 5M5 13v7h14v-7" fill="none" stroke="currentColor" strokeWidth="2.2" />
            </svg>
            <span className="cs-share__txt">Bagikan</span>
          </button>
        </div>
      </header>

      <main id="main">
        <section className="cs-hero" aria-labelledby="cs-title">
          <div className="cs-hero__bg" aria-hidden="true">
            <ArtImage game="cs2" custom={j.bg} className="cs-hero__blur" sizes="40vw" />
          </div>

          <div className="cs-hero__main">
            <p className="cs-kicker">
              <span>{j.mode || def.fullName}</span>
              {mapCode && <code>{mapCode}</code>}
            </p>
            <Split as="h1" id="cs-title" className="cs-hero__title" text={j.headline} by="words" style={{ '--scale': scale } as React.CSSProperties} />
            {j.subline && <p className="cs-hero__sub">{j.subline}</p>}
            <div className="cs-hero__cta">
              <a className="cs-btn cs-btn--accent" href="#join">
                {isClosed(s) ? 'Tanya jadwal berikutnya' : def.cta}
              </a>
              {!isClosed(s) && (
                <button className="cs-btn cs-btn--line" type="button" onClick={actions.calendar}>
                  Simpan ke kalender
                </button>
              )}
            </div>
          </div>

          <figure className="cs-screen" aria-hidden="true">
            <span className="cs-corner" />
            <div className="cs-screen__frame">
              <ArtImage game="cs2" custom={j.bg} className="cs-screen__img" sizes={HERO_SIZES.cs2} priority transitionName={`jk-art-${j.id}`} />
            </div>
            <figcaption className="cs-screen__tag">{mapCode || 'counter-strike 2'}</figcaption>
            <Spray />
          </figure>

          <div className="cs-hud cs-hud--left">
            <HudCorner />
            <div className="cs-hud__cell">
              <span className="cs-hud__label">Tanggal</span>
              <span className="cs-hud__big">{formatDateShort(j.date)}</span>
              <span className="cs-hud__small">{dayName(j.date)}</span>
            </div>
            <div className="cs-hud__cell">
              <span className="cs-hud__label">Jam ({j.tz})</span>
              <span className="cs-hud__big">{formatClock(j.time)}</span>
              <span className="cs-hud__small">{j.endTime ? `sampai ${formatClock(j.endTime)}` : 'kurang lebih 3 jam'}</span>
            </div>
          </div>

          <div className="cs-hud cs-hud--right">
            <HudCorner />
            <span className="cs-hud__label">Pemain</span>
            <span className="cs-ammo">
              <b>{s.filled}</b>
              <span>/ {j.slots}</span>
            </span>
            <span className="cs-hud__small">{s.full ? 'penuh, cadangan boleh' : `${s.open} slot kosong`}</span>
          </div>
        </section>

        <section className="cs-info" aria-labelledby="cs-info-title">
          <SectionTitle id="cs-info-title" no="01" text="Info match" />
          <div className="cs-info__grid">
            {known ? (
              <MapOverview
                map={known}
                name={j.map}
                dots={joined.map((p) => ({ id: p.id, slot: j.players.indexOf(p) }))}
                side={j.variant === 'ct' ? 'CT' : 'T'}
                site={named}
                hot={hot}
                onHot={setHot}
              />
            ) : (
              <Radar players={joined.length} site={named} />
            )}
            <div className="cs-info__side">
              {known && <MapCard map={known} name={j.map} />}
              <dl className="cs-info__list">
                {j.mode && <InfoRow k="Mode" v={j.mode} />}
                {j.map && <InfoRow k="Map" v={j.map} note={mapCode} />}
                {j.rank && <InfoRow k="Rank" v={j.rank} />}
                {j.host && <InfoRow k="Host" v={j.host} />}
                {j.lobby && (
                  <InfoRow k={def.lobbyLabel} v={j.lobby} mono>
                    <button className="cs-btn cs-btn--line cs-btn--sm" type="button" onClick={copyLobby}>
                      Salin
                    </button>
                  </InfoRow>
                )}
                {j.voice && (
                  <InfoRow k="Voice" v="Discord / voice room">
                    <a className="cs-btn cs-btn--line cs-btn--sm" href={j.voice} target="_blank" rel="noopener noreferrer">
                      Masuk voice
                    </a>
                  </InfoRow>
                )}
              </dl>
            </div>
          </div>
        </section>

        <section className="cs-board" aria-labelledby="cs-board-title">
          <div className="cs-board__head">
            <SectionTitle id="cs-board-title" no="02" text="Scoreboard" />
          </div>
          <div className="cs-board__grid">
            <div className="cs-board__table" role="table" aria-label="Daftar pemain">
              <div className="cs-board__team" aria-hidden="true">
                <span>{j.variant === 'ct' ? 'Counter-Terrorist' : 'Terrorist'}</span>
                <span className="cs-board__meta">
                  <b>{s.filled}</b> / {j.slots} siap{s.full ? ' · penuh' : ''}
                </span>
              </div>
              <div className="cs-board__row cs-board__row--head" role="row">
                <span role="columnheader">#</span>
                <span role="columnheader">Pemain</span>
                <span role="columnheader">Role</span>
                <span role="columnheader">Senjata</span>
                <span role="columnheader">Status</span>
              </div>
              {slots.map((p, i) => (
                <BoardRow
                  key={p?.id ?? `empty-${i}`}
                  index={i}
                  player={p}
                  host={j.host}
                  fresh={Boolean(p && marks.fresh.has(p.id))}
                  me={Boolean(p && p.id === marks.me)}
                  hot={Boolean(p && p.id === hot)}
                  onHot={setHot}
                />
              ))}
              {reserves.map((p, i) => (
                <BoardRow key={p.id} index={j.slots + i} player={p} host={j.host} reserve fresh={marks.fresh.has(p.id)} me={p.id === marks.me} />
              ))}
            </div>
            {joined.length > 0 && (
              <ul className="cs-feed" aria-label="Pemain yang sudah masuk">
                {joined.slice(0, 6).map((p) => (
                  <li className="cs-feed__item" key={p.id} data-pc={pc(j.players.indexOf(p))}>
                    <span className="cs-feed__name">{p.name}</span>
                    {p.pick && <span className="cs-feed__gun">{p.pick}</span>}
                    <span className="cs-feed__verb">masuk</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="cs-join" id="join" aria-labelledby="cs-join-title">
          <div className="cs-join__intro">
            <SectionTitle id="cs-join-title" no="03" text={joinTitle(s, 'Buy menu')} />
            <p className="cs-join__text">
              {j.autoJoin
                ? 'Pilih role dan senjata andalan, lalu konfirmasi. Namamu langsung masuk scoreboard tanpa menunggu host.'
                : 'Pilih role dan senjata andalan, lalu konfirmasi. WhatsApp terbuka dengan pesan siap kirim ke host.'}
            </p>
            {!isClosed(s) && <Loadout role={loadout.role} pick={loadout.pick} />}
          </div>
          <JoinForm
            j={j}
            session={s}
            className="cs-form"
            cta={def.cta}
            renderRole={({ value, onChange, options, labelId, needed }) => (
              <div className="chips cs-chips" role="radiogroup" aria-labelledby={labelId}>
                <Mirror value={value} onValue={mirrorRole} />
                {options.map((r) => (
                  <label className={`chip cs-chip ${needed?.includes(r) ? 'is-needed' : ''}`} key={r}>
                    <input type="radio" name="cs-role" value={r} checked={value === r} onChange={() => onChange(r)} />
                    <span>{r}</span>
                  </label>
                ))}
              </div>
            )}
            renderPick={({ value, onChange, options, labelId }) => (
              <div className="cs-buy" role="radiogroup" aria-labelledby={labelId}>
                <Mirror value={value} onValue={mirrorPick} />
                {options.map((w, i) => {
                  const info = WEAPONS[w]
                  return (
                    <label className="cs-buy__item" key={w}>
                      <input type="radio" name="cs-weapon" value={w} checked={value === w} onChange={() => onChange(w)} />
                      <span className="cs-buy__card" data-kind={info?.kind}>
                        {info && <span className="cs-buy__price">${info.price}</span>}
                        <span className="cs-buy__key">{i < 9 ? i + 1 : i === 9 ? 0 : ''}</span>
                        <span className="cs-buy__name">{w}</span>
                        <span className="cs-buy__kind">
                          {info?.kind}
                          {info?.side && <em data-side={info.side}>{info.side}</em>}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
            onSent={(kind) => {
              setSentKind(kind)
              setReadyKey((k) => k + 1)
            }}
          />
        </section>

        {j.notes && (
          <section className="cs-notes" aria-labelledby="cs-notes-title">
            <SectionTitle id="cs-notes-title" no="04" text="Aturan ronde" />
            <ol className="cs-notes__list">
              {j.notes
                .split('\n')
                .filter((l) => l.trim())
                .map((line, i) => (
                  <li key={i}>
                    <span className="cs-notes__num" aria-hidden="true">
                      <small>Ronde</small>
                      {pad2(i + 1)}
                    </span>
                    <span className="cs-notes__text">{line}</span>
                  </li>
                ))}
            </ol>
          </section>
        )}

        <Schedule items={others} title="Match lain" className="cs-sched" />
      </main>

      <SiteFooter media={media} className="cs-foot" />

      <MusicDock j={j} />

      <div className="cs-accept" aria-hidden="true">
        <div className="cs-accept__panel">
          <p className="cs-accept__title">{sentKind === 'joined' ? 'Slot kamu siap' : 'Pesan siap dikirim'}</p>
          {sentKind === 'joined' && (
            <div className="cs-accept__slots">
              {Array.from({ length: j.slots }, (_, i) => (
                <span key={i} className={`cs-accept__slot ${i < s.filled ? 'is-in' : ''}`} />
              ))}
            </div>
          )}
          <p className="cs-accept__btn">{sentKind === 'joined' ? 'Accepted' : 'Buka WhatsApp'}</p>
          <p className="cs-accept__sub">{sentKind === 'joined' ? 'Namamu sudah masuk scoreboard.' : 'Tinggal tekan kirim di WhatsApp.'}</p>
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ id, text, no }: { id: string; text: string; no: string }) {
  return (
    <h2 className="cs-title" id={id}>
      <span className="cs-title__no" aria-hidden="true">
        {no}
      </span>
      <span className="cs-title__text">{text}</span>
    </h2>
  )
}

/** Meneruskan nilai pilihan form ke komponen induk tanpa mengubah state saat render. */
function Mirror({ value, onValue }: { value: string; onValue: (v: string) => void }) {
  useEffect(() => onValue(value), [value, onValue])
  return null
}

const KIND_LABEL: Record<string, string> = { Pistol: 'Pistol', SMG: 'SMG', Heavy: 'Heavy', Rifle: 'Rifle', Sniper: 'Sniper' }

/** Pratinjau loadout: senjata dan role yang sedang dipilih di form, dengan warna rarity kategorinya. */
function Loadout({ role, pick }: { role: string; pick: string }) {
  const info = WEAPONS[pick]
  return (
    <div className="cs-loadout" data-kind={info?.kind} aria-hidden="true">
      <p className="cs-loadout__label">Loadout kamu</p>
      <p className={`cs-loadout__gun ${pick ? '' : 'is-empty'}`}>{pick || 'Belum pilih senjata'}</p>
      {info && (
        <p className="cs-loadout__meta">
          <span className="cs-loadout__kind">{KIND_LABEL[info.kind] ?? info.kind}</span>
          {info.side && <span className={`cs-loadout__side cs-loadout__side--${info.side.toLowerCase()}`}>{info.side}</span>}
          <span className="cs-loadout__price">${info.price}</span>
        </p>
      )}
      <p className="cs-loadout__role">
        Role <b>{role || 'Bebas'}</b>
      </p>
    </div>
  )
}

function HudCorner() {
  return <span className="cs-corner" aria-hidden="true" />
}

function RoundTimer({ s }: { s: SessionInfo }) {
  const { days, hours, minutes, seconds } = s.parts
  if (s.state !== 'upcoming' && s.state !== 'live') {
    return <span className={`cs-timer cs-timer--text cs-timer--${s.state}`}>{statusLabel(s)}</span>
  }
  return (
    <span className={`cs-timer ${s.state === 'live' ? 'is-live' : ''}`} role="timer" aria-label={s.state === 'live' ? 'Sisa waktu sesi' : 'Hitung mundur ke mulai'}>
      <span className="cs-timer__label">{s.state === 'live' ? 'Sisa' : 'Mulai dalam'}</span>
      <span className="cs-timer__value">
        {days > 0 && (
          <>
            <Digits value={days} />
            <i>h</i>
          </>
        )}
        <Digits value={hours} />:<Digits value={minutes} />:<Digits value={seconds} />
      </span>
    </span>
  )
}

function InfoRow({ k, v, note, mono, children }: { k: string; v: string; note?: string; mono?: boolean; children?: React.ReactNode }) {
  return (
    <div className="cs-info__row">
      <dt>{k}</dt>
      <dd>
        <span className={mono ? 'cs-mono' : ''}>{v}</span>
        {note && note.toLowerCase() !== v.toLowerCase() && <code className="cs-info__note">{note}</code>}
        {children}
      </dd>
    </div>
  )
}

function BoardRow({
  index,
  player,
  host,
  reserve,
  fresh,
  me,
  hot,
  onHot,
}: {
  index: number
  player: Player | null
  host: string
  reserve?: boolean
  fresh?: boolean
  me?: boolean
  hot?: boolean
  onHot?: (id: string | null) => void
}) {
  if (!player) {
    return (
      <div className="cs-board__row is-empty" role="row">
        <span role="cell" className="cs-board__no">
          {index + 1}
        </span>
        <span role="cell" className="cs-board__empty">
          <a href="#join">Slot kosong, ambil</a>
        </span>
        <span role="cell" aria-hidden="true" />
        <span role="cell" aria-hidden="true" />
        <span role="cell" aria-hidden="true" />
      </div>
    )
  }
  const isHost = host.trim() && host.trim().toLowerCase() === player.name.trim().toLowerCase()
  return (
    <div
      className={`cs-board__row ${player.status === 'maybe' ? 'is-maybe' : ''} ${reserve ? 'is-reserve' : ''}`}
      role="row"
      data-pc={pc(index)}
      data-fresh={fresh || undefined}
      data-me={me || undefined}
      data-hot={hot || undefined}
      onMouseEnter={() => onHot?.(player.id)}
      onMouseLeave={() => onHot?.(null)}
    >
      <span role="cell" className="cs-board__no">
        {index + 1}
      </span>
      <span role="cell" className="cs-board__name">
        {player.name}
        {isHost && <em className="cs-board__tag">host</em>}
        {me && <em className="cs-board__tag cs-board__tag--me">kamu</em>}
        {reserve && <em className="cs-board__tag">cadangan</em>}
        {(player.role || player.pick) && <small className="cs-board__sub">{[player.role, player.pick].filter(Boolean).join(' · ')}</small>}
      </span>
      <span role="cell">{player.role || '-'}</span>
      <span role="cell">{player.pick || '-'}</span>
      <span role="cell" className="cs-board__status">
        {player.status === 'maybe' ? 'Belum pasti' : 'Siap'}
      </span>
    </div>
  )
}

function Spray() {
  return (
    <svg className="cs-spray" viewBox="0 0 120 230" aria-hidden="true">
      {SPRAY.map(([x, y], i) => (
        <g className="cs-spray__dot" key={i}>
          <circle cx={x} cy={y} r="5.2" className="cs-spray__ring" />
          <circle cx={x} cy={y} r="2.4" className="cs-spray__core" />
        </g>
      ))}
    </svg>
  )
}

const at = (p: MapPoint): CSSProperties => ({ left: `${p.x * 100}%`, top: `${p.y * 100}%` })

/** Lapisan radar diperbesar sehingga hanya area `view` yang terlihat. Ikon ikut lapisan, jadi posisinya tetap tepat. */
const layerStyle = (v: Cs2Map['view']): CSSProperties => ({
  width: `${100 / v.size}%`,
  height: `${100 / v.size}%`,
  left: `${(-v.x / v.size) * 100}%`,
  top: `${(-v.y / v.size) * 100}%`,
})

/** Titik pemain melingkari spawn, supaya jumlahnya terbaca tanpa menutupi ikon spawn. */
function around(p: MapPoint, count: number): MapPoint[] {
  const n = Math.min(count, 10)
  const r = n > 5 ? 0.052 : 0.042
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(n, 5)
    return { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r }
  })
}

/**
 * Overview map resmi (radar dari file game) dengan ikon seperti loading screen CS2: spawn T dan CT,
 * bombsite A/B atau sandera. Titik pemain yang sudah masuk berkumpul di spawn sisi yang dipilih host.
 */
function MapOverview({
  map,
  name,
  dots,
  side,
  site,
  hot,
  onHot,
}: {
  map: Cs2Map
  name: string
  dots: { id: string; slot: number }[]
  side: 'T' | 'CT'
  site: 'A' | 'B' | null
  hot: string | null
  onHot: (id: string | null) => void
}) {
  const players = dots.length
  const [level, setLevel] = useState<'upper' | 'lower'>('upper')
  useEffect(() => setLevel('upper'), [map.code])
  const spawn = side === 'T' ? map.t : map.ct
  const hostage = map.marks.some((m) => m.kind === 'H')
  const lower = level === 'lower' && Boolean(map.lower)
  // Ikon milik lantai lain diredupkan supaya tidak terbaca seolah ada di radar yang sedang tampil.
  const off = (onLower: boolean) => (onLower !== lower ? 'is-other-level' : '')
  const summary = `${players} pemain di spawn ${side}${site ? `, rencana ke site ${site}` : ''}`
  return (
    <figure className="cs-map" aria-label={`Overview ${name}: ${summary}`}>
      <div className="cs-map__head">
        <span className="cs-map__label">Overview</span>
        <code className="cs-map__code">{map.code}</code>
        {map.lower && (
          <div className="cs-map__levels" role="group" aria-label="Lantai radar">
            {(
              [
                ['upper', 'Atas'],
                ['lower', 'Bawah'],
              ] as const
            ).map(([v, label]) => (
              <button key={v} type="button" className="cs-map__level" aria-pressed={level === v} onClick={() => setLevel(v)}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="cs-map__radar">
        <span className="cs-corner" aria-hidden="true" />
        <div className="cs-map__layer" style={layerStyle(map.view)}>
          <img className="cs-map__img" src={level === 'lower' && map.lower ? map.lower : map.radar} alt="" width={1024} height={1024} loading="lazy" decoding="async" />
          <span className={`cs-map__spawn cs-map__spawn--t ${off(false)}`} style={at(map.t)} aria-hidden="true">
            T
          </span>
          <span className={`cs-map__spawn cs-map__spawn--ct ${off(false)}`} style={at(map.ct)} aria-hidden="true">
            CT
          </span>
          {map.marks.map((m, i) => (
            <span
              key={`${m.kind}${i}`}
              className={`cs-map__site ${m.kind === 'H' ? 'is-hostage' : ''} ${m.kind === site ? 'is-target' : ''} ${off(Boolean(m.lower))}`}
              style={at(m)}
              aria-hidden="true"
            >
              {m.kind}
            </span>
          ))}
          {around(spawn, players).map((p, i) => (
            <span
              key={dots[i]?.id ?? i}
              className={`cs-map__player ${off(false)} ${dots[i]?.id === hot ? 'is-hot' : ''}`}
              data-pc={pc(dots[i]?.slot ?? i)}
              style={at(p)}
              aria-hidden="true"
              onMouseEnter={() => dots[i] && onHot(dots[i].id)}
              onMouseLeave={() => onHot(null)}
            />
          ))}
        </div>
      </div>
      <figcaption className="cs-map__legend">
        <span className="cs-map__key cs-map__key--t">Spawn T</span>
        <span className="cs-map__key cs-map__key--ct">Spawn CT</span>
        <span className={`cs-map__key cs-map__key--site ${hostage ? 'is-hostage' : ''}`}>{hostage ? 'Sandera' : 'Bombsite'}</span>
        <span className="cs-map__key cs-map__key--you">{players > 0 ? `${players} pemain, sisi ${side}` : `Sisi ${side}, belum ada pemain`}</span>
        {site && <span className="cs-map__key cs-map__key--plan">Rencana: site {site}</span>}
        {(lower || map.marks.some((m) => m.lower)) && <span className="cs-map__key cs-map__key--note">Ikon redup ada di lantai {lower ? 'atas' : 'bawah'}</span>}
      </figcaption>
    </figure>
  )
}

/** Kartu map seperti di menu pilih map CS2: screenshot resmi, emblem, nama, dan jenis map. */
function MapCard({ map, name }: { map: Cs2Map; name: string }) {
  return (
    <div className="cs-mapcard">
      <img className="cs-mapcard__shot" src={map.shot} alt="" width={1280} height={720} loading="lazy" decoding="async" />
      <div className="cs-mapcard__meta">
        <img className="cs-mapcard__icon" src={map.icon} alt="" width={192} height={192} loading="lazy" decoding="async" />
        <div>
          <p className="cs-mapcard__name">{name}</p>
          <p className="cs-mapcard__type">
            {map.code.startsWith('cs_') ? 'Hostage rescue' : 'Bomb defusal'} · <code>{map.code}</code>
          </p>
        </div>
      </div>
    </div>
  )
}

/** Radar orisinal (bukan layout map asli). Titik pemain di spawn = jumlah pemain yang sudah masuk. */
function Radar({ players, site }: { players: number; site: 'A' | 'B' | null }) {
  const dots = Array.from({ length: Math.min(players, 10) }, (_, i) => [118 + (i % 5) * 11, 218 + Math.floor(i / 5) * 11])
  return (
    <figure className="cs-radar" aria-label={`Radar: ${players} pemain di spawn`}>
      <svg viewBox="0 0 280 280">
        <defs>
          <clipPath id="cs-radar-clip">
            <circle cx="140" cy="140" r="132" />
          </clipPath>
        </defs>
        <circle cx="140" cy="140" r="132" className="cs-radar__disc" />
        <g clipPath="url(#cs-radar-clip)">
          <path className="cs-radar__walls" d="M30 70h70v40h40V60h80v60h-40v40h60v70H180v-40h-50v60H70v-70H30z" />
          <path className="cs-radar__lane" d="M110 240V170h40v-60h50M150 110V70M70 160h60" />
          <rect className={`cs-radar__site ${site === 'A' ? 'is-target' : ''}`} x="44" y="80" width="46" height="40" />
          <rect className={`cs-radar__site ${site === 'B' ? 'is-target' : ''}`} x="178" y="128" width="46" height="44" />
          <text x="67" y="107" className="cs-radar__letter">
            A
          </text>
          <text x="201" y="157" className="cs-radar__letter">
            B
          </text>
          {dots.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="4" className="cs-radar__player" />
          ))}
          <path className="cs-radar__sweep" d="M140 140 L140 8 A132 132 0 0 1 233 47 Z" />
        </g>
        <circle cx="140" cy="140" r="132" className="cs-radar__rim" />
      </svg>
      <figcaption className="cs-radar__cap">{site ? `Rencana: site ${site}` : `${players} pemain di spawn`}</figcaption>
    </figure>
  )
}

function CsIntro({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [n, setN] = useState(3)
  useGSAP(
    () => {
      const tl = gsap.timeline({ onComplete: onDone })
      tl.from('.cs-intro__label', { opacity: 0, y: 10, duration: 0.3 })
      ;[2, 1, 0].forEach((v, i) => tl.call(() => setN(v), [], 0.45 + i * 0.38))
      tl.to('.cs-intro__flash', { opacity: 1, duration: 0.07 }, 1.7)
        .set('.cs-intro__content', { autoAlpha: 0 }, 1.78)
        .set(ref.current, { backgroundColor: 'transparent' }, 1.78)
        .to('.cs-intro__flash', { opacity: 0, duration: 0.8, ease: 'power2.out' }, 1.8)
    },
    { scope: ref },
  )
  return (
    <div className="intro cs-intro" ref={ref}>
      <div className="cs-intro__content" aria-hidden="true">
        <p className="cs-intro__label">Freeze time</p>
        <p className="cs-intro__count">0:0{n}</p>
      </div>
      <span className="cs-intro__flash" aria-hidden="true" />
      <button className="intro__skip" type="button" onClick={onDone}>
        Lewati intro
      </button>
    </div>
  )
}
