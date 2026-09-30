import '@fontsource/saira-stencil-one/400.css'
import '@fontsource/rajdhani/500.css'
import '@fontsource/rajdhani/600.css'
import '@fontsource/rajdhani/700.css'
import '@fontsource/noto-sans/400.css'
import '@fontsource/noto-sans/600.css'
import '@fontsource/noto-sans/700.css'
import './cs2.css'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { gameDef } from '../../../shared/games'
import { dayName, formatClock, formatDateShort, pad2 } from '../../../shared/time'
import type { Player } from '../../../shared/types'
import { copyText } from '../../common/actions'
import { ArtImage } from '../../common/ArtImage'
import { usePage, type ThemeProps } from '../../common/context'
import { Digits } from '../../common/Digits'
import { Schedule, SiteFooter, useActions } from '../../common/Extras'
import { gsap, MOTION_OK, useGSAP } from '../../common/gsap'
import { isClosed, joinTitle, statusLabel, useSession, type SessionInfo } from '../../common/hooks'
import { useIntroGate } from '../../common/intro'
import { JoinForm, type SentKind } from '../../common/JoinForm'
import { MusicDock } from '../../common/Music'
import { Split } from '../../common/Split'
import { useToast } from '../../common/Toast'
import { CS2_MAPS, type Cs2Map, type MapPoint } from './maps'

const def = gameDef('cs2')

/** Kelas senjata dan sisi yang bisa membelinya di buy menu (T saja, CT saja, atau dua-duanya). */
const WEAPONS: Record<string, { kind: string; side: 'T' | 'CT' | '' }> = {
  'AK-47': { kind: 'Rifle', side: 'T' },
  M4A4: { kind: 'Rifle', side: 'CT' },
  'M4A1-S': { kind: 'Rifle', side: 'CT' },
  AWP: { kind: 'Sniper', side: '' },
  'Desert Eagle': { kind: 'Pistol', side: '' },
  'Galil AR': { kind: 'Rifle', side: 'T' },
  FAMAS: { kind: 'Rifle', side: 'CT' },
  'SSG 08': { kind: 'Sniper', side: '' },
  MP9: { kind: 'SMG', side: 'CT' },
  'MAC-10': { kind: 'SMG', side: 'T' },
  P90: { kind: 'SMG', side: '' },
  Nova: { kind: 'Heavy', side: '' },
  'USP-S': { kind: 'Pistol', side: 'CT' },
  'Glock-18': { kind: 'Pistol', side: 'T' },
}

/** Kurang lebih pola recoil AK-47 (naik, ke kiri, lalu ke kanan) dalam kotak 120 x 220. */
const SPRAY: [number, number][] = [
  [60, 212], [61, 198], [59, 182], [62, 164], [60, 145], [63, 126], [66, 108], [68, 92], [70, 78], [71, 66],
  [64, 57], [53, 52], [42, 49], [32, 46], [25, 47], [20, 42], [29, 37], [41, 35], [55, 34], [69, 31],
  [83, 29], [95, 31], [103, 27], [97, 22],
]

export default function Cs2Page({ j }: ThemeProps) {
  const { preview, others, replay, media } = usePage()
  const s = useSession(j)
  const intro = useIntroGate('cs2', preview, replay)
  const actions = useActions(j)
  const toast = useToast()
  const root = useRef<HTMLDivElement>(null)
  const [readyKey, setReadyKey] = useState(0)
  const [sentKind, setSentKind] = useState<SentKind>('joined')

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
          .from('.cs-screen', { opacity: 0, x: 70, duration: 0.8, ease: 'power4.out' }, 0.1)
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

  // Setelah konfirmasi: banner "READY" ala pesan tengah layar CS.
  useGSAP(
    () => {
      if (!readyKey) return
      gsap.matchMedia().add(MOTION_OK, () => {
        gsap
          .timeline()
          .fromTo('.cs-ready', { autoAlpha: 0, y: -30 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' })
          .to('.cs-ready', { autoAlpha: 0, y: -20, duration: 0.4, delay: 1.4 })
      })
    },
    { scope: root, dependencies: [readyKey] },
  )

  const copyLobby = async () => toast((await copyText(j.lobby)) ? `${def.lobbyLabel} disalin.` : 'Gagal menyalin.')

  return (
    <div className="cs" data-variant={j.variant} ref={root}>
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
              <ArtImage game="cs2" custom={j.bg} className="cs-screen__img" sizes="(max-width: 900px) 92vw, 46vw" priority />
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
          <SectionTitle id="cs-info-title" text="Info match" />
          <div className="cs-info__grid">
            {known ? (
              <MapOverview map={known} name={j.map} players={joined.length} side={j.variant === 'ct' ? 'CT' : 'T'} site={named} />
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
            <SectionTitle id="cs-board-title" text="Scoreboard" />
            <p className="cs-board__meta">
              {s.filled}/{j.slots} siap{s.full ? ' · penuh' : ''}
            </p>
          </div>
          <div className="cs-board__grid">
            <div className="cs-board__table" role="table" aria-label="Daftar pemain">
              <div className="cs-board__row cs-board__row--head" role="row">
                <span role="columnheader">#</span>
                <span role="columnheader">Pemain</span>
                <span role="columnheader">Role</span>
                <span role="columnheader">Senjata</span>
                <span role="columnheader">Status</span>
              </div>
              {slots.map((p, i) => (
                <BoardRow key={p?.id ?? `empty-${i}`} index={i} player={p} host={j.host} />
              ))}
              {reserves.map((p, i) => (
                <BoardRow key={p.id} index={j.slots + i} player={p} host={j.host} reserve />
              ))}
            </div>
            {joined.length > 0 && (
              <ul className="cs-feed" aria-label="Pemain yang sudah masuk">
                {joined.slice(0, 6).map((p) => (
                  <li className="cs-feed__item" key={p.id}>
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
            <SectionTitle id="cs-join-title" text={joinTitle(s, 'Buy menu')} />
            <p className="cs-join__text">
              {j.autoJoin
                ? 'Pilih role dan senjata andalan, lalu konfirmasi. Namamu langsung masuk scoreboard tanpa menunggu host.'
                : 'Pilih role dan senjata andalan, lalu konfirmasi. WhatsApp terbuka dengan pesan siap kirim ke host.'}
            </p>
          </div>
          <JoinForm
            j={j}
            session={s}
            className="cs-form"
            cta={def.cta}
            renderRole={({ value, onChange, options, labelId }) => (
              <div className="chips cs-chips" role="radiogroup" aria-labelledby={labelId}>
                {options.map((r) => (
                  <label className="chip cs-chip" key={r}>
                    <input type="radio" name="cs-role" value={r} checked={value === r} onChange={() => onChange(r)} />
                    <span>{r}</span>
                  </label>
                ))}
              </div>
            )}
            renderPick={({ value, onChange, options, labelId }) => (
              <div className="cs-buy" role="radiogroup" aria-labelledby={labelId}>
                {options.map((w, i) => (
                  <label className="cs-buy__item" key={w}>
                    <input type="radio" name="cs-weapon" value={w} checked={value === w} onChange={() => onChange(w)} />
                    <span className="cs-buy__card">
                      <span className="cs-buy__key">{i < 9 ? i + 1 : i === 9 ? 0 : ''}</span>
                      <span className="cs-buy__name">{w}</span>
                      <span className="cs-buy__kind">
                        {WEAPONS[w]?.kind}
                        {WEAPONS[w]?.side && <em>{WEAPONS[w].side}</em>}
                      </span>
                    </span>
                  </label>
                ))}
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
            <SectionTitle id="cs-notes-title" text="Aturan ronde" />
            <ol className="cs-notes__list">
              {j.notes.split('\n').filter((l) => l.trim()).map((line, i) => (
                <li key={i}>
                  <span className="cs-notes__num">{pad2(i + 1)}</span>
                  {line}
                </li>
              ))}
            </ol>
          </section>
        )}

        <Schedule items={others} title="Match lain" className="cs-sched" />
      </main>

      <SiteFooter media={media} className="cs-foot" />

      <MusicDock j={j} />

      <div className="cs-ready" aria-hidden="true">
        {sentKind === 'joined' ? 'Ready. Kamu sudah masuk scoreboard.' : 'Siap. Tinggal kirim pesannya di WhatsApp.'}
      </div>
    </div>
  )
}

function SectionTitle({ id, text }: { id: string; text: string }) {
  return (
    <h2 className="cs-title" id={id}>
      {text}
    </h2>
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

function BoardRow({ index, player, host, reserve }: { index: number; player: Player | null; host: string; reserve?: boolean }) {
  if (!player) {
    return (
      <div className="cs-board__row is-empty" role="row">
        <span role="cell">{index + 1}</span>
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
    <div className={`cs-board__row ${player.status === 'maybe' ? 'is-maybe' : ''} ${reserve ? 'is-reserve' : ''}`} role="row">
      <span role="cell">{index + 1}</span>
      <span role="cell" className="cs-board__name">
        {player.name}
        {isHost && <em className="cs-board__tag">host</em>}
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
function MapOverview({ map, name, players, side, site }: { map: Cs2Map; name: string; players: number; side: 'T' | 'CT'; site: 'A' | 'B' | null }) {
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
          <img
            className="cs-map__img"
            src={level === 'lower' && map.lower ? map.lower : map.radar}
            alt=""
            width={1024}
            height={1024}
            loading="lazy"
            decoding="async"
          />
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
            <span key={i} className={`cs-map__player ${off(false)}`} style={at(p)} aria-hidden="true" />
          ))}
        </div>
      </div>
      <figcaption className="cs-map__legend">
        <span className="cs-map__key cs-map__key--t">Spawn T</span>
        <span className="cs-map__key cs-map__key--ct">Spawn CT</span>
        <span className={`cs-map__key cs-map__key--site ${hostage ? 'is-hostage' : ''}`}>{hostage ? 'Sandera' : 'Bombsite'}</span>
        <span className="cs-map__key cs-map__key--you">
          {players > 0 ? `${players} pemain, sisi ${side}` : `Sisi ${side}, belum ada pemain`}
        </span>
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
