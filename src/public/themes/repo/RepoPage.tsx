import '@fontsource/teko/500.css'
import '@fontsource/teko/600.css'
import '@fontsource/teko/700.css'
import '@fontsource/vt323/400.css'
import '@fontsource/archivo-narrow/400.css'
import '@fontsource/archivo-narrow/500.css'
import '@fontsource/archivo-narrow/600.css'
import '@fontsource/archivo-narrow/700.css'
import './repo.css'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { gameDef, REPO_COLORS } from '../../../shared/games'
import { dateBlocks, formatClock, formatDateLong, formatTimeRange, pad2 } from '../../../shared/time'
import type { Player } from '../../../shared/types'
import { copyText } from '../../common/actions'
import { ArtImage } from '../../common/ArtImage'
import { usePage, type ThemeProps } from '../../common/context'
import { Schedule, SiteFooter, useActions } from '../../common/Extras'
import { gsap, MOTION_OK, useGSAP } from '../../common/gsap'
import { isClosed, joinTitle, statusLabel, useSession, type SessionInfo } from '../../common/hooks'
import { useIntroGate } from '../../common/intro'
import { JoinForm } from '../../common/JoinForm'
import { MusicDock } from '../../common/Music'
import { Split } from '../../common/Split'
import { useToast } from '../../common/Toast'

const def = gameDef('repo')

/** Akronim bertitik ala R.E.P.O.: "JARKOMAN" menjadi "J.A.R.K.O.M.A.N." */
const dotted = (word: string) => `${word.split('').join('.')}.`

export default function RepoPage({ j }: ThemeProps) {
  const { preview, others, replay, media } = usePage()
  const s = useSession(j)
  const intro = useIntroGate('repo', preview, replay)
  const actions = useActions(j)
  const toast = useToast()
  const root = useRef<HTMLDivElement>(null)
  const hero = useRef<HTMLElement>(null)
  const [sentKey, setSentKey] = useState(0)

  const flashlight = j.variant !== 'lampu'
  const scale = j.headline.length <= 14 ? 1 : j.headline.length <= 24 ? 0.78 : 0.6
  const slots = Array.from({ length: j.slots }, (_, i) => j.players[i] ?? null)
  const reserves = j.players.slice(j.slots)
  const date = dateBlocks(j.date)

  // Senter mengikuti pointer. Hanya menggelapkan latar; teks selalu berada di atas lapisan gelap.
  useEffect(() => {
    const el = hero.current
    if (!el || !flashlight) return
    let raf = 0
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--mx', `${x}px`)
        el.style.setProperty('--my', `${y}px`)
      })
    }
    el.addEventListener('pointermove', move)
    return () => {
      el.removeEventListener('pointermove', move)
      cancelAnimationFrame(raf)
    }
  }, [flashlight])

  useGSAP(
    () => {
      gsap.matchMedia().add(MOTION_OK, () => {
        if (!intro.ready) return
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
        tl.from('.rp-hero__title .split-word', { yPercent: 100, opacity: 0, duration: 0.7, stagger: 0.09 }, 0.1)
          .from('.rp-tag', { opacity: 0, x: -20, duration: 0.4, stagger: 0.06 }, 0)
          .from('.rp-hero__sub', { opacity: 0, duration: 0.6 }, 0.45)
          .from('.rp-hero__cta > *', { opacity: 0, y: 18, duration: 0.45, stagger: 0.08 }, 0.6)
          .from('.rp-truck', { opacity: 0, y: 40, duration: 0.8 }, 0.3)
          // Layar CRT menyala: garis tipis melebar jadi layar penuh.
          .fromTo('.rp-crt__screen', { clipPath: 'inset(49.5% 0 49.5% 0)' }, { clipPath: 'inset(0% 0 0% 0)', duration: 0.5, ease: 'power4.out' }, 0.8)
          .from('.rp-crt__feed', { opacity: 0, filter: 'brightness(3) contrast(0.4)', duration: 0.6, ease: 'steps(6)' }, 1.05)
          .from('.rp-crt__line', { opacity: 0, x: -8, duration: 0.25, stagger: 0.08 }, 1.3)

        gsap.from('.rp-bot', {
          scrollTrigger: { trigger: '.rp-crew__grid', start: 'top 85%', once: true },
          y: 80,
          opacity: 0,
          duration: 0.7,
          stagger: 0.09,
          ease: 'back.out(1.6)',
        })
        gsap.from('.rp-quota__fill', {
          scrollTrigger: { trigger: '.rp-quota', start: 'top 90%', once: true },
          scaleX: 0,
          transformOrigin: '0 50%',
          duration: 1.2,
          ease: 'power2.out',
        })
        gsap.utils.toArray<HTMLElement>('.rp-title').forEach((el) => {
          gsap.from(el, { scrollTrigger: { trigger: el, start: 'top 88%', once: true }, opacity: 0, y: 30, duration: 0.6 })
        })
        // Pesan Taxman diketik baris per baris.
        gsap.utils.toArray<HTMLElement>('.rp-memo__line').forEach((line, i) => {
          const chars = Math.max(8, line.textContent?.length ?? 8)
          gsap.fromTo(
            line,
            { clipPath: 'inset(0 100% 0 0)' },
            {
              clipPath: 'inset(0 0% 0 0)',
              duration: Math.min(2.4, chars * 0.03),
              ease: `steps(${Math.min(chars, 60)})`,
              delay: i * 0.5,
              scrollTrigger: { trigger: '.rp-memo', start: 'top 80%', once: true },
            },
          )
        })
      })
    },
    { scope: root, dependencies: [intro.ready, replay], revertOnUpdate: true },
  )

  useGSAP(
    () => {
      if (!sentKey) return
      gsap.matchMedia().add(MOTION_OK, () => {
        gsap
          .timeline()
          .fromTo('.rp-sent', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1, repeat: 3, yoyo: true })
          .set('.rp-sent', { autoAlpha: 1 })
          .to('.rp-sent', { autoAlpha: 0, duration: 0.4, delay: 1.3 })
      })
    },
    { scope: root, dependencies: [sentKey] },
  )

  const copyLobby = async () => toast((await copyText(j.lobby)) ? `${def.lobbyLabel} disalin.` : 'Gagal menyalin.')
  const noteLines = j.notes.split('\n').filter((l) => l.trim())

  return (
    <div className="rp" data-variant={j.variant} ref={root}>
      {intro.show && <RpIntro onDone={intro.done} />}

      <header className="rp-top">
        <a className="rp-top__mark" href="#main" aria-label="Jarkoman, ke atas">
          {dotted('JARKOMAN')}
        </a>
        <span className={`rp-status rp-status--${s.state}`}>{statusLabel(s)}</span>
        <button className="rp-btn rp-btn--line rp-btn--sm" type="button" onClick={actions.share}>
          Bagikan
        </button>
      </header>

      <main id="main">
        <section className={`rp-hero ${flashlight ? 'has-light' : ''}`} ref={hero} aria-labelledby="rp-title">
          <div className="rp-hero__bg" aria-hidden="true">
            <Corridor />
            <span className="rp-eyes rp-eyes--a">
              <i />
              <i />
            </span>
            <span className="rp-eyes rp-eyes--b">
              <i />
              <i />
            </span>
            <span className="rp-dark" />
            <span className="rp-grain" />
          </div>

          <div className="rp-hero__inner">
            <div className="rp-hero__main">
              <p className="rp-tags">
                <span className="rp-tag rp-tag--game">{def.name}</span>
                {j.mode && <span className="rp-tag">{j.mode}</span>}
              </p>
              <Split as="h1" id="rp-title" className="rp-hero__title" text={j.headline} by="words" style={{ '--scale': scale } as CSSProperties} />
              {j.subline && <p className="rp-hero__sub">{j.subline}</p>}
              <div className="rp-hero__cta">
                <a className="rp-btn rp-btn--hazard" href="#join">
                  {isClosed(s) ? 'Tanya jadwal berikutnya' : def.cta}
                </a>
                {!isClosed(s) && (
                  <button className="rp-btn rp-btn--line" type="button" onClick={actions.calendar}>
                    Simpan ke kalender
                  </button>
                )}
              </div>
            </div>

            <div className="rp-truck">
              <p className="rp-truck__label">Monitor truk</p>
              <div className="rp-crt">
                <div className="rp-crt__screen">
                  <div className="rp-crt__feed">
                    <ArtImage game="repo" custom={j.bg} className="rp-crt__img" sizes="420px" priority />
                  </div>
                  <p className="rp-crt__line">&gt; {def.mapLabel.toUpperCase()}: {(j.map || 'Acak').toUpperCase()}</p>
                  {j.rank && <p className="rp-crt__line">&gt; TARGET: {j.rank.toUpperCase()}</p>}
                  <p className="rp-crt__line">
                    &gt; SHIFT: {date.dow} {date.day} {date.month} · {formatClock(j.time)} {j.tz}
                  </p>
                  <p className="rp-crt__line">
                    &gt; SEMIBOT: {s.filled}/{j.slots}
                  </p>
                  <RpCountdown s={s} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rp-crew" aria-labelledby="rp-crew-title">
          <SectionTitle id="rp-crew-title" text="Semibot terdaftar" />
          <div className="rp-quota">
            <p className="rp-quota__label">
              Kuota semibot <b>{s.filled}</b>/{j.slots}
              {s.full && <span> · truk penuh, sisanya cadangan</span>}
            </p>
            <div className="rp-quota__bar" role="progressbar" aria-valuemin={0} aria-valuemax={j.slots} aria-valuenow={s.filled} aria-label="Kuota semibot">
              <span className="rp-quota__fill" style={{ width: `${Math.min(100, (s.filled / j.slots) * 100)}%` }} />
            </div>
          </div>
          <ul className="rp-crew__grid" style={{ '--cols': Math.max(3, j.slots) } as CSSProperties}>
            {slots.map((p, i) => (
              <li key={p?.id ?? `empty-${i}`}>
                <BotCard player={p} host={j.host} />
              </li>
            ))}
          </ul>
          {reserves.length > 0 && (
            <p className="rp-reserve">
              <span>Cadangan:</span> {reserves.map((r) => r.name).join(', ')}
            </p>
          )}
        </section>

        <section className="rp-info" aria-labelledby="rp-info-title">
          <SectionTitle id="rp-info-title" text="Surat tugas" />
          <dl className="rp-order">
            {j.mode && (
              <div className="rp-order__row">
                <dt>Tugas</dt>
                <dd>{j.mode}</dd>
              </div>
            )}
            {j.map && (
              <div className="rp-order__row">
                <dt>{def.mapLabel}</dt>
                <dd>{j.map}</dd>
              </div>
            )}
            {j.rank && (
              <div className="rp-order__row">
                <dt>{def.rankLabel}</dt>
                <dd>{j.rank}</dd>
              </div>
            )}
            <div className="rp-order__row">
              <dt>Shift</dt>
              <dd>
                {formatDateLong(j.date)}, {formatTimeRange(j)}
              </dd>
            </div>
            {j.host && (
              <div className="rp-order__row">
                <dt>Host</dt>
                <dd>{j.host}</dd>
              </div>
            )}
            {j.lobby && (
              <div className="rp-order__row">
                <dt>{def.lobbyLabel}</dt>
                <dd>
                  {j.lobby}
                  <button className="rp-btn rp-btn--line rp-btn--sm" type="button" onClick={copyLobby}>
                    Salin
                  </button>
                </dd>
              </div>
            )}
            {j.voice && (
              <div className="rp-order__row">
                <dt>Voice</dt>
                <dd>
                  Proximity chat di game, koordinasi di voice room
                  <a className="rp-btn rp-btn--line rp-btn--sm" href={j.voice} target="_blank" rel="noopener noreferrer">
                    Masuk voice
                  </a>
                </dd>
              </div>
            )}
          </dl>
          <p className="rp-stamp" aria-hidden="true">
            Disetujui Taxman
          </p>
        </section>

        <section className="rp-join" id="join" aria-labelledby="rp-join-title">
          <SectionTitle id="rp-join-title" text={joinTitle(s, 'Daftar shift')} />
          <p className="rp-lead">Pilih warna semibot dan tugasmu. Tombol di bawah membuka WhatsApp dengan pesan konfirmasi siap kirim.</p>
          <JoinForm
            j={j}
            session={s}
            className="rp-form"
            cta={def.cta}
            renderRole={({ value, onChange, options, labelId }) => (
              <div className="rp-swatches" role="radiogroup" aria-labelledby={labelId}>
                {options.map((c) => (
                  <label className="rp-swatch" key={c} style={{ '--c': REPO_COLORS[c] } as CSSProperties}>
                    <input type="radio" name="rp-color" value={c} checked={value === c} onChange={() => onChange(c)} />
                    <span className="rp-swatch__dot" aria-hidden="true" />
                    <span className="rp-swatch__name">{c}</span>
                  </label>
                ))}
              </div>
            )}
            renderPick={({ value, onChange, options, labelId }) => (
              <div className="chips rp-chips" role="radiogroup" aria-labelledby={labelId}>
                {options.map((t) => (
                  <label className="chip rp-chip" key={t}>
                    <input type="radio" name="rp-task" value={t} checked={value === t} onChange={() => onChange(t)} />
                    <span>{t}</span>
                  </label>
                ))}
              </div>
            )}
            onSent={() => setSentKey((k) => k + 1)}
          />
        </section>

        {noteLines.length > 0 && (
          <section className="rp-notes" aria-labelledby="rp-notes-title">
            <SectionTitle id="rp-notes-title" text="Pesan dari host" />
            <div className="rp-crt rp-memo">
              <div className="rp-crt__screen">
                {noteLines.map((line, i) => (
                  <p className="rp-memo__line" key={i}>
                    {pad2(i + 1)} {line}
                  </p>
                ))}
              </div>
            </div>
          </section>
        )}

        <Schedule items={others} title="Shift lain" className="rp-sched" />
      </main>

      <SiteFooter media={media} className="rp-foot" />

      <MusicDock j={j} />

      <div className="rp-sent" aria-hidden="true">
        Pesan siap. Kirim di WhatsApp sebelum truk berangkat.
      </div>
    </div>
  )
}

function SectionTitle({ id, text }: { id: string; text: string }) {
  return (
    <h2 className="rp-title" id={id}>
      {text}
    </h2>
  )
}

function RpCountdown({ s }: { s: SessionInfo }) {
  if (s.state !== 'upcoming' && s.state !== 'live') {
    return <p className="rp-crt__big rp-crt__big--state">{statusLabel(s).toUpperCase()}</p>
  }
  const { days, hours, minutes, seconds } = s.parts
  return (
    <div className="rp-crt__cd" role="timer" aria-label={s.state === 'live' ? 'Sisa waktu shift' : 'Hitung mundur ke mulai'}>
      <p className="rp-crt__line">{s.state === 'live' ? '> SHIFT BERJALAN, SISA:' : '> TRUK BERANGKAT DALAM:'}</p>
      <p className="rp-crt__big">
        {days > 0 && <span>{days}H </span>}
        {pad2(hours)}:{pad2(minutes)}:<span className="rp-crt__sec">{pad2(seconds)}</span>
      </p>
    </div>
  )
}

/** Semibot: badan kapsul dan kepala bulat dengan dua mata besar, seperti di key art. Warna mengikuti pilihan pemain. */
function Semibot({ color, dim }: { color: string; dim?: boolean }) {
  return (
    <svg className={`rp-bot__svg ${dim ? 'is-dim' : ''}`} viewBox="0 0 100 132" aria-hidden="true" style={{ '--bot': color } as CSSProperties}>
      <ellipse cx="50" cy="126" rx="30" ry="5" className="rp-bot__shadow" />
      <rect x="24" y="58" width="52" height="64" rx="26" className="rp-bot__body" />
      <rect x="24" y="58" width="52" height="64" rx="26" className="rp-bot__shade" />
      <rect x="44" y="52" width="12" height="10" rx="3" className="rp-bot__neck" />
      <g className="rp-bot__head">
        <ellipse cx="50" cy="36" rx="25" ry="22" className="rp-bot__body" />
        <ellipse cx="50" cy="36" rx="25" ry="22" className="rp-bot__shade" />
        {dim ? (
          <text x="50" y="42" className="rp-bot__q">
            ?
          </text>
        ) : (
          <>
            <circle cx="39" cy="28" r="10" className="rp-bot__eyeball" />
            <circle cx="61" cy="28" r="10" className="rp-bot__eyeball" />
            <circle cx="41.5" cy="29.5" r="4.2" className="rp-bot__pupil" />
            <circle cx="58.5" cy="29.5" r="4.2" className="rp-bot__pupil" />
          </>
        )}
      </g>
    </svg>
  )
}

function BotCard({ player, host }: { player: Player | null; host: string }) {
  if (!player) {
    return (
      <a className="rp-bot rp-bot--empty" href="#join">
        <Semibot color="#3a3630" dim />
        <span className="rp-bot__name">Slot kosong</span>
        <span className="rp-bot__task">Daftar sekarang</span>
      </a>
    )
  }
  const color = REPO_COLORS[player.role] ?? '#c9c0ad'
  const isHost = host.trim() && host.trim().toLowerCase() === player.name.trim().toLowerCase()
  return (
    <div className={`rp-bot ${player.status === 'maybe' ? 'is-maybe' : ''}`}>
      <Semibot color={color} />
      <span className="rp-bot__name">{player.name}</span>
      <span className="rp-bot__task">
        {[player.pick, player.role && `semibot ${player.role.toLowerCase()}`].filter(Boolean).join(' · ') || 'Tugas bebas'}
      </span>
      {(isHost || player.status === 'maybe') && <span className="rp-bot__tag">{isHost ? 'Host' : 'Belum pasti'}</span>}
    </div>
  )
}

/** Lorong gelap orisinal dalam perspektif satu titik: garis lantai, pintu, dan lampu mati. */
function Corridor() {
  return (
    <svg className="rp-corridor" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
      <g className="rp-corridor__lines">
        <path d="M0 0L700 380M1600 0L900 380M0 900L700 520M1600 900L900 520" />
        <rect x="700" y="380" width="200" height="140" />
        <path d="M120 52v760M260 112v615M380 164v540M1480 52v760M1340 112v615M1220 164v540" />
        <path d="M0 900L700 520M300 900l500-380M1300 900L800 520M600 900l200-380M1000 900L800 520" className="rp-corridor__floor" />
        <path d="M150 180h80v420h-80zM1370 180h80v420h-80z" className="rp-corridor__door" />
      </g>
      <rect x="760" y="392" width="80" height="6" className="rp-corridor__lamp" />
    </svg>
  )
}

function RpIntro({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      const tl = gsap.timeline({ onComplete: onDone })
      tl.set('.rp-intro__tube', { opacity: 0 })
        .to('.rp-intro__tube', { opacity: 0.9, duration: 0.05 }, 0.2)
        .to('.rp-intro__tube', { opacity: 0.1, duration: 0.05 }, 0.32)
        .to('.rp-intro__tube', { opacity: 0.8, duration: 0.05 }, 0.6)
        .to('.rp-intro__tube', { opacity: 0.2, duration: 0.05 }, 0.7)
        .to('.rp-intro__tube', { opacity: 1, duration: 0.05 }, 1.05)
        .to('.rp-intro__glow', { opacity: 1, duration: 0.5 }, 1.05)
        .from('.rp-intro__text', { opacity: 0, y: 12, duration: 0.4 }, 1.15)
        .to(ref.current, { autoAlpha: 0, duration: 0.45 }, 1.9)
    },
    { scope: ref },
  )
  return (
    <div className="intro rp-intro" ref={ref}>
      <span className="rp-intro__tube" aria-hidden="true" />
      <span className="rp-intro__glow" aria-hidden="true" />
      <p className="rp-intro__text" aria-hidden="true">
        Shift dimulai
      </p>
      <button className="intro__skip" type="button" onClick={onDone}>
        Lewati intro
      </button>
    </div>
  )
}
