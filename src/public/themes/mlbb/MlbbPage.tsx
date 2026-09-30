import '@fontsource/oswald/500.css'
import '@fontsource/oswald/600.css'
import '@fontsource/oswald/700.css'
import '@fontsource/rubik/400.css'
import '@fontsource/rubik/500.css'
import '@fontsource/rubik/600.css'
import '@fontsource/rubik/700.css'
import '@fontsource/rubik/900-italic.css'
import './mlbb.css'
import { useRef, useState, type CSSProperties } from 'react'
import { gameDef } from '../../../shared/games'
import { formatDateLong, formatTimeRange } from '../../../shared/time'
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
import { Embers } from './Embers'
import { LandOfDawn } from './LandOfDawn'

const def = gameDef('mlbb')

/** Callout pertempuran MLBB dipakai untuk jumlah pemain yang sudah masuk. */
const STREAK = ['', 'First Blood', 'Double Kill', 'Triple Kill', 'Maniac', 'Savage']

export default function MlbbPage({ j }: ThemeProps) {
  const { preview, others, replay, media } = usePage()
  const s = useSession(j)
  const intro = useIntroGate('mlbb', preview, replay)
  const actions = useActions(j)
  const toast = useToast()
  const root = useRef<HTMLDivElement>(null)
  const [sentKey, setSentKey] = useState(0)
  const [sentKind, setSentKind] = useState<SentKind>('joined')

  const streak = STREAK[Math.min(s.filled, 5)]
  const scale = j.headline.length <= 16 ? 1 : j.headline.length <= 26 ? 0.8 : 0.64
  const slots = Array.from({ length: j.slots }, (_, i) => j.players[i] ?? null)
  const teams = j.slots > 5 ? [slots.slice(0, 5), slots.slice(5)] : [slots]
  const reserves = j.players.slice(j.slots)

  useGSAP(
    () => {
      gsap.matchMedia().add(MOTION_OK, () => {
        if (!intro.ready) return
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
        tl.from('.ml-banner', { opacity: 0, duration: 1.2, ease: 'power2.out' }, 0)
          .from('.ml-banner__img', { scale: 1.12, duration: 2.2, ease: 'power3.out' }, 0)
          .from('.ml-rays', { opacity: 0, scale: 0.6, rotate: -30, duration: 1.6, ease: 'power2.out' }, 0.2)
          .from('.ml-crest', { scale: 0.4, opacity: 0, duration: 0.9, ease: 'back.out(1.8)' }, 0.1)
          .from('.ml-hero__game', { opacity: 0, letterSpacing: '0.6em', duration: 0.9 }, 0.2)
          .from('.ml-hero__title .split-char', { opacity: 0, scale: 1.6, filter: 'blur(8px)', duration: 0.7, stagger: 0.03 }, 0.3)
          .fromTo('.ml-hero__title', { '--shine': '-30%' }, { '--shine': '130%', duration: 1.4, ease: 'power2.inOut' }, 1)
          .from('.ml-hero__sub', { opacity: 0, y: 16, duration: 0.6 }, 0.8)
          .from('.ml-plaque', { opacity: 0, y: 30, duration: 0.7 }, 0.9)
          .from('.ml-cd__cell', { opacity: 0, scale: 0.6, duration: 0.5, stagger: 0.07, ease: 'back.out(2)' }, 1)
          .from('.ml-hero__cta > *', { opacity: 0, y: 20, duration: 0.5, stagger: 0.08 }, 1.1)
        if (document.querySelector('.ml-streak__word')) {
          tl.from('.ml-streak__word', { scale: 2.4, opacity: 0, rotate: -8, duration: 0.5, ease: 'power4.in' }, 1.3)
            .from('.ml-streak__ring', { scale: 0.2, opacity: 1, duration: 0.8, ease: 'power2.out' }, 1.78)
            .to('.ml-streak__ring', { opacity: 0, duration: 0.4 }, 2.2)
            .from('.ml-streak__caption', { opacity: 0, y: 8, duration: 0.4 }, 1.9)
        }

        gsap.utils.toArray<HTMLElement>('.ml-title').forEach((el) => {
          gsap.from(el.querySelectorAll('.ml-title__orn'), {
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
            scaleX: 0,
            duration: 0.8,
            ease: 'power3.out',
          })
          gsap.from(el.querySelector('.ml-title__text'), {
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
            opacity: 0,
            y: 20,
            duration: 0.7,
          })
        })

        gsap.utils.toArray<HTMLElement>('.ml-team').forEach((team, ti) => {
          // Animasikan <li>, bukan kartunya: kartu punya transisi CSS transform untuk hover.
          gsap.from(team.querySelectorAll(':scope > li'), {
            scrollTrigger: { trigger: team, start: 'top 85%', once: true },
            x: ti % 2 === 0 ? -120 : 120,
            opacity: 0,
            duration: 0.8,
            stagger: 0.08,
            ease: 'power3.out',
          })
        })

        const lanes = gsap.utils.toArray<SVGPathElement>('.ml-map__lane-line')
        lanes.forEach((path) => {
          const len = path.getTotalLength()
          gsap.fromTo(
            path,
            { strokeDasharray: len, strokeDashoffset: len },
            { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut', scrollTrigger: { trigger: '.ml-map', start: 'top 80%', once: true } },
          )
        })
        gsap.from('.ml-map__hero', {
          scrollTrigger: { trigger: '.ml-map', start: 'top 75%', once: true },
          scale: 0,
          opacity: 0,
          duration: 0.5,
          stagger: 0.1,
          delay: 1,
          ease: 'back.out(2)',
        })
        gsap.from('.ml-intel__item', {
          scrollTrigger: { trigger: '.ml-intel', start: 'top 85%', once: true },
          y: 30,
          opacity: 0,
          duration: 0.6,
          stagger: 0.07,
        })
      })
    },
    { scope: root, dependencies: [intro.ready, replay], revertOnUpdate: true },
  )

  // Setelah konfirmasi: sapuan cahaya emas pada tombol dan pesan singkat.
  useGSAP(
    () => {
      if (!sentKey) return
      gsap.matchMedia().add(MOTION_OK, () => {
        gsap
          .timeline()
          .fromTo('.ml-victory', { autoAlpha: 0, scale: 1.4 }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'power4.out' })
          .to('.ml-victory', { autoAlpha: 0, duration: 0.5, delay: 1.2 })
      })
    },
    { scope: root, dependencies: [sentKey] },
  )

  const copyLobby = async () => toast((await copyText(j.lobby)) ? `${def.lobbyLabel} disalin.` : 'Gagal menyalin.')

  return (
    <div className="ml" data-variant={j.variant} ref={root}>
      {intro.show && <MlIntro onDone={intro.done} />}

      <header className="ml-top">
        <a className="ml-top__mark" href="#main" aria-label="Jarkoman, ke atas">
          Jarkoman
        </a>
        <span className={`ml-status ml-status--${s.state}`}>{statusLabel(s)}</span>
        <button className="ml-btn ml-btn--ghost ml-btn--sm" type="button" onClick={actions.share}>
          Bagikan
        </button>
      </header>

      <main id="main">
        <section className="ml-hero" aria-labelledby="ml-title">
          <div className="ml-hero__bg" aria-hidden="true">
            <div className="ml-banner">
              <ArtImage game="mlbb" custom={j.bg} className="ml-banner__img" sizes="100vw" priority />
            </div>
            <div className="ml-rays" />
            <Embers className="ml-embers" />
          </div>

          <div className="ml-hero__inner">
            <Crest />
            <p className="ml-hero__game">{def.fullName}</p>
            <Split as="h1" id="ml-title" className="ml-hero__title" text={j.headline} by="chars" style={{ '--scale': scale } as CSSProperties} />
            {j.subline && <p className="ml-hero__sub">{j.subline}</p>}

            <div className="ml-streak" aria-live="polite">
              {streak ? (
                <>
                  <span className="ml-streak__ring" aria-hidden="true" />
                  <p className="ml-streak__word" data-level={Math.min(s.filled, 5)}>
                    {streak}
                  </p>
                  <p className="ml-streak__caption">
                    {s.filled} dari {j.slots} pemain sudah masuk
                  </p>
                </>
              ) : (
                <p className="ml-streak__caption">Belum ada yang masuk. Jadi yang pertama.</p>
              )}
            </div>

            <div className="ml-plaque ml-glass">
              <span className="ml-orn ml-orn--tl" aria-hidden="true" />
              <span className="ml-orn ml-orn--br" aria-hidden="true" />
              <p className="ml-plaque__date">{formatDateLong(j.date)}</p>
              <p className="ml-plaque__time">{formatTimeRange(j)}</p>
              <MlCountdown s={s} />
            </div>

            <div className="ml-hero__cta">
              <a className="ml-btn ml-btn--gold" href="#join">
                {isClosed(s) ? 'Tanya jadwal berikutnya' : def.cta}
              </a>
              {!isClosed(s) && (
                <button className="ml-btn ml-btn--ghost" type="button" onClick={actions.calendar}>
                  Simpan ke kalender
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="ml-lineup" aria-labelledby="ml-lineup-title">
          <SectionTitle id="ml-lineup-title" text="Lineup" />
          <p className="ml-lead">
            {s.full ? 'Tim sudah lengkap. Yang daftar sekarang masuk cadangan.' : `${s.open} slot masih terbuka. Pilih lane yang kosong biar draft enak.`}
          </p>
          {teams.map((team, ti) => (
            <div className="ml-team-wrap" key={ti}>
              {teams.length > 1 && <p className="ml-team__label">{ti === 0 ? 'Tim 1' : 'Tim 2'}</p>}
              <ol className="ml-team" style={{ '--cols': team.length } as CSSProperties}>
                {team.map((p, i) => (
                  <li key={p?.id ?? `empty-${ti}-${i}`}>
                    <LineupCard player={p} index={ti * 5 + i} host={j.host} />
                  </li>
                ))}
              </ol>
              {teams.length > 1 && ti === 0 && (
                <p className="ml-vs" aria-hidden="true">
                  VS
                </p>
              )}
            </div>
          ))}
          {reserves.length > 0 && (
            <p className="ml-reserve">
              <span>Cadangan:</span> {reserves.map((r) => r.name).join(', ')}
            </p>
          )}
        </section>

        <section className="ml-dawn" aria-labelledby="ml-dawn-title">
          <SectionTitle id="ml-dawn-title" text="Land of Dawn" />
          <div className="ml-dawn__grid">
            <LandOfDawn players={j.players.slice(0, j.slots)} side={j.variant === 'red' ? 'red' : 'blue'} />
            <dl className="ml-intel">
              {j.mode && <Intel k="Mode" v={j.mode} />}
              {j.map && <Intel k={def.mapLabel} v={j.map} />}
              {j.rank && <Intel k="Rank" v={j.rank} />}
              {j.host && <Intel k="Host" v={j.host} />}
              {j.lobby && (
                <Intel k={def.lobbyLabel} v={j.lobby}>
                  <button className="ml-btn ml-btn--ghost ml-btn--sm" type="button" onClick={copyLobby}>
                    Salin
                  </button>
                </Intel>
              )}
              {j.voice && (
                <Intel k="Voice" v="Discord / voice room">
                  <a className="ml-btn ml-btn--ghost ml-btn--sm" href={j.voice} target="_blank" rel="noopener noreferrer">
                    Masuk voice
                  </a>
                </Intel>
              )}
            </dl>
          </div>
        </section>

        <section className="ml-join" id="join" aria-labelledby="ml-join-title">
          <SectionTitle id="ml-join-title" text={joinTitle(s, 'Pilih lane kamu')} />
          <p className="ml-lead">
            {j.autoJoin
              ? 'Pilih lane dan hero andalan. Tekan tombolnya dan namamu langsung masuk lineup.'
              : 'Pilih lane dan hero andalan. Tombolnya membuka WhatsApp dengan pesan konfirmasi yang sudah jadi.'}
          </p>
          <div className="ml-join__panel">
            <span className="ml-orn ml-orn--tl" aria-hidden="true" />
            <span className="ml-orn ml-orn--br" aria-hidden="true" />
            <JoinForm
              j={j}
              session={s}
              className="ml-form"
              cta={def.cta}
              renderRole={({ value, onChange, options, labelId }) => {
                const taken = new Set(j.players.filter((p) => p.status === 'in').map((p) => p.role))
                return (
                  <div className="ml-lanes" role="radiogroup" aria-labelledby={labelId}>
                    {options.map((lane) => (
                      <label className="ml-lane" key={lane}>
                        <input type="radio" name="ml-lane" value={lane} checked={value === lane} onChange={() => onChange(lane)} />
                        <span className="ml-lane__card">
                          <LaneIcon lane={lane} />
                          <span className="ml-lane__name">{lane}</span>
                          {taken.has(lane) && <span className="ml-lane__taken">sudah ada</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                )
              }}
              renderPick={({ value, onChange, options, labelId }) => (
                <>
                  <input
                    className="jf__input"
                    aria-labelledby={labelId}
                    list="ml-heroes"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Ketik nama hero, misalnya Ling"
                    maxLength={32}
                  />
                  <datalist id="ml-heroes">
                    {options.map((h) => (
                      <option key={h} value={h} />
                    ))}
                  </datalist>
                </>
              )}
              onSent={(kind) => {
                setSentKind(kind)
                setSentKey((k) => k + 1)
              }}
            />
          </div>
        </section>

        {j.notes && (
          <section className="ml-notes" aria-labelledby="ml-notes-title">
            <SectionTitle id="ml-notes-title" text="Aturan main" />
            <ul className="ml-notes__list">
              {j.notes.split('\n').filter((l) => l.trim()).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </section>
        )}

        <Schedule items={others} title="Jadwal lain" className="ml-sched" />
      </main>

      <SiteFooter media={media} className="ml-foot" />

      <MusicDock j={j} />

      <div className="ml-victory" aria-hidden="true">
        <span>{sentKind === 'joined' ? 'Slot terkunci' : 'Pesan siap'}</span>
        <small>{sentKind === 'joined' ? 'Namamu sudah masuk lineup' : 'Kirim di WhatsApp untuk mengunci slot'}</small>
      </div>
    </div>
  )
}

function SectionTitle({ id, text }: { id: string; text: string }) {
  return (
    <h2 className="ml-title" id={id}>
      <span className="ml-title__orn" aria-hidden="true" />
      <span className="ml-title__text">{text}</span>
      <span className="ml-title__orn ml-title__orn--r" aria-hidden="true" />
    </h2>
  )
}

function Intel({ k, v, children }: { k: string; v: string; children?: React.ReactNode }) {
  return (
    <div className="ml-intel__item">
      <dt>{k}</dt>
      <dd>
        <span>{v}</span>
        {children}
      </dd>
    </div>
  )
}

function MlCountdown({ s }: { s: SessionInfo }) {
  if (s.state !== 'upcoming' && s.state !== 'live') {
    return <p className={`ml-cd-state ml-cd-state--${s.state}`}>{statusLabel(s)}</p>
  }
  const cells: [number, string][] = [
    [s.parts.days, 'Hari'],
    [s.parts.hours, 'Jam'],
    [s.parts.minutes, 'Menit'],
    [s.parts.seconds, 'Detik'],
  ]
  return (
    <div className="ml-cd" role="timer" aria-label={s.state === 'live' ? 'Sisa waktu sesi' : 'Hitung mundur ke mulai'}>
      <p className="ml-cd__label">{s.state === 'live' ? 'Pertempuran berlangsung, sisa' : `Mulai ${s.rel}`}</p>
      <div className="ml-cd__cells">
        {cells.map(([v, label]) => (
          <div className="ml-cd__cell" key={label}>
            <Digits value={v} className="ml-cd__num" />
            <span className="ml-cd__unit">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LineupCard({ player, index, host }: { player: Player | null; index: number; host: string }) {
  if (!player) {
    return (
      <a className="ml-card ml-card--empty" href="#join">
        <span className="ml-card__slot">Slot {index + 1}</span>
        <span className="ml-card__sil" aria-hidden="true">
          ?
        </span>
        <span className="ml-card__open">Slot terbuka</span>
        <span className="ml-card__take">Isi sekarang</span>
      </a>
    )
  }
  const isHost = host.trim() && host.trim().toLowerCase() === player.name.trim().toLowerCase()
  return (
    <article className={`ml-card ${player.status === 'maybe' ? 'is-maybe' : ''}`}>
      <span className="ml-card__slot">Slot {index + 1}</span>
      <div className="ml-card__lane">
        {player.role ? <LaneIcon lane={player.role} /> : null}
        <span>{player.role || 'Lane bebas'}</span>
      </div>
      <span className="ml-card__initial" aria-hidden="true">
        {player.name.slice(0, 1)}
      </span>
      <div className="ml-card__foot">
        {isHost && <span className="ml-card__tag">Host</span>}
        {player.status === 'maybe' && <span className="ml-card__tag ml-card__tag--maybe">Belum pasti</span>}
        <h3 className="ml-card__name">{player.name}</h3>
        <p className="ml-card__hero">{player.pick || 'Hero bebas'}</p>
      </div>
    </article>
  )
}

/** Ikon lane: peta mini dengan lane yang bersangkutan disorot. Satu keluarga ikon, orisinal. */
export function LaneIcon({ lane }: { lane: string }) {
  return (
    <svg className="ml-lane-ico" viewBox="0 0 40 40" aria-hidden="true">
      <rect x="3" y="3" width="34" height="34" rx="3" className="ml-lane-ico__frame" />
      <path d="M8 32V8h24" className={`ml-lane-ico__path ${lane === 'EXP Lane' ? 'is-on' : ''}`} />
      <path d="M8 32h24V8" className={`ml-lane-ico__path ${lane === 'Gold Lane' ? 'is-on' : ''}`} />
      <path d="M8 32L32 8" className={`ml-lane-ico__path ${lane === 'Mid Lane' ? 'is-on' : ''}`} />
      {lane === 'Jungle' && (
        <g className="ml-lane-ico__dots">
          <circle cx="15" cy="15" r="2.6" />
          <circle cx="25" cy="25" r="2.6" />
          <circle cx="20" cy="11" r="1.8" />
          <circle cx="29" cy="20" r="1.8" />
        </g>
      )}
      {lane === 'Roam' && <path d="M11 27c4-12 10-2 18-15" className="ml-lane-ico__roam" />}
    </svg>
  )
}

function Crest() {
  return (
    <svg className="ml-crest" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id="ml-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1c1" />
          <stop offset="0.5" stopColor="#f0c45c" />
          <stop offset="1" stopColor="#a8741f" />
        </linearGradient>
        <linearGradient id="ml-crystal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9f8ff" />
          <stop offset="0.5" stopColor="#5ce1ff" />
          <stop offset="1" stopColor="#1b5c9c" />
        </linearGradient>
      </defs>
      <path d="M60 6l46 26v56L60 114 14 88V32z" fill="none" stroke="url(#ml-gold)" strokeWidth="4" />
      <path d="M60 18l35 20v44L60 102 25 82V38z" fill="none" stroke="url(#ml-gold)" strokeWidth="1.5" opacity="0.6" />
      <path d="M60 30l18 30-18 30-18-30z" fill="url(#ml-crystal)" className="ml-crest__crystal" />
      <path d="M60 30v60M42 60h36" stroke="#fff" strokeOpacity="0.45" strokeWidth="1" />
    </svg>
  )
}

function MlIntro({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      const tl = gsap.timeline({ onComplete: onDone })
      tl.from('.ml-intro .ml-crest', { scale: 0.5, opacity: 0, duration: 0.6, ease: 'back.out(2)' })
        .from('.ml-intro__label', { opacity: 0, duration: 0.3 }, 0.3)
        .fromTo('.ml-intro__fill', { scaleX: 0 }, { scaleX: 1, duration: 1.1, ease: 'power2.inOut' }, 0.3)
        .to('.ml-intro .ml-crest', { scale: 1.3, opacity: 0, duration: 0.4, ease: 'power2.in' }, 1.45)
        .to(ref.current, { autoAlpha: 0, duration: 0.35 }, 1.6)
    },
    { scope: ref },
  )
  return (
    <div className="intro ml-intro" ref={ref}>
      <div className="ml-intro__inner" aria-hidden="true">
        <Crest />
        <p className="ml-intro__label">Memuat Land of Dawn</p>
        <span className="ml-intro__bar">
          <span className="ml-intro__fill" />
        </span>
      </div>
      <button className="intro__skip" type="button" onClick={onDone}>
        Lewati intro
      </button>
    </div>
  )
}

