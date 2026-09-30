import '@fontsource/anton/400.css'
import '@fontsource/barlow/400.css'
import '@fontsource/barlow/500.css'
import '@fontsource/barlow/600.css'
import '@fontsource/barlow/700.css'
import '@fontsource/barlow/800.css'
import './valorant.css'
import { useRef, useState, type CSSProperties } from 'react'
import { gameDef, roleOfPick } from '../../../shared/games'
import { dateBlocks, formatDateLong, formatTimeRange } from '../../../shared/time'
import type { MapMedia, Player } from '../../../shared/types'
import { copyText } from '../../common/actions'
import { HERO_SIZES } from '../../../shared/art'
import { ArtImage } from '../../common/ArtImage'
import { usePage, type ThemeProps } from '../../common/context'
import { Digits } from '../../common/Digits'
import { Schedule, SiteFooter, useActions } from '../../common/Extras'
import { gsap, MOTION_OK, useGSAP } from '../../common/gsap'
import { isClosed, joinTitle, statusLabel, useSession, type SessionInfo } from '../../common/hooks'
import { useIntroGate } from '../../common/intro'
import { JoinForm } from '../../common/JoinForm'
import { MusicDock } from '../../common/Music'
import { Split } from '../../common/Split'
import { useToast } from '../../common/Toast'

const def = gameDef('valorant')

export default function ValorantPage({ j }: ThemeProps) {
  const { preview, others, replay, media } = usePage()
  const s = useSession(j)
  const intro = useIntroGate('valorant', preview, replay)
  const actions = useActions(j)
  const toast = useToast()
  const root = useRef<HTMLDivElement>(null)
  const [lockKey, setLockKey] = useState(0)

  const date = dateBlocks(j.date)
  const scale = j.headline.length <= 14 ? 1 : j.headline.length <= 24 ? 0.8 : 0.62

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MOTION_OK, () => {
        if (!intro.ready) return
        const tl = gsap.timeline({ defaults: { ease: 'power4.out' } })
        // Panel key art masuk dari kanan, garis merah menyusul sepanjang diagonal.
        tl.from('.val-hero__art', { clipPath: 'polygon(100% 0, 100% 0, 100% 100%, 100% 100%)', duration: 1.1, ease: 'power4.inOut' }, 0)
          .from('.val-hero__edge', { xPercent: 60, opacity: 0, duration: 0.9 }, 0.25)
          .from('.val-hero__img', { scale: 1.18, duration: 1.8, ease: 'power3.out' }, 0)
          .from('.val-hero__ghost', { opacity: 0, x: 80, duration: 1.4, ease: 'power2.out' }, 0)
          .from('.val-hero__title .split-char', { yPercent: 115, duration: 0.85, stagger: 0.022 }, 0.12)
          .from('.val-kicker', { clipPath: 'inset(0 100% 0 0)', duration: 0.6, ease: 'power3.inOut' }, 0.2)
          .from('.val-hero__sub', { y: 18, opacity: 0, duration: 0.6 }, 0.55)
          .from('.val-card > *', { x: 48, opacity: 0, duration: 0.7, stagger: 0.07 }, 0.35)
          .from('.val-hero__cta > *', { y: 24, opacity: 0, duration: 0.55, stagger: 0.07 }, 0.65)
          .from('.val-squares i', { scale: 0, duration: 0.4, stagger: 0.05, ease: 'back.out(3)' }, 0.8)

        gsap.to('.val-hero__ghost', {
          yPercent: -22,
          ease: 'none',
          scrollTrigger: { trigger: '.val-hero', start: 'top top', end: 'bottom top', scrub: true },
        })

        // Judul section: blok merah menyapu masuk menutup teks, lalu keluar dari sisi lain membuka teks.
        gsap.utils.toArray<HTMLElement>('.val-wipe').forEach((el) => {
          const cover = el.querySelector('.val-wipe__cover')
          const text = el.querySelector('.val-wipe__text')
          const wipe = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 86%', once: true } })
          wipe
            .fromTo(text, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, 0.42)
            .fromTo(cover, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.42, ease: 'power3.in' }, 0)
            .set(cover, { transformOrigin: '100% 50%' })
            .to(cover, { scaleX: 0, duration: 0.5, ease: 'power3.out' })
        })

        if (document.querySelector('.val-map')) {
          const reveal = gsap.timeline({ scrollTrigger: { trigger: '.val-map', start: 'top 80%', once: true } })
          reveal
            .fromTo('.val-map__wipe', { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.45, ease: 'power3.in' })
            .set('.val-map__wipe', { transformOrigin: '100% 50%' })
            .to('.val-map__wipe', { scaleX: 0, duration: 0.55, ease: 'power3.out' })
            .from('.val-map__name', { yPercent: 40, opacity: 0, duration: 0.6, ease: 'power4.out' }, 0.5)
          // Minimap hanya ada kalau gambar dari valorant-api tersedia.
          if (document.querySelector('.val-map__mini')) {
            reveal.from('.val-map__mini', { x: 30, opacity: 0, duration: 0.6, ease: 'power3.out' }, 0.6)
            if (document.querySelector('.val-map__mark')) reveal.from('.val-map__mark', { scale: 0, duration: 0.35, stagger: 0.07, ease: 'back.out(2.4)' }, 0.9)
          }
        }

        gsap.from('.val-intel__item', {
          scrollTrigger: { trigger: '.val-intel__grid', start: 'top 85%', once: true },
          y: 40,
          opacity: 0,
          duration: 0.7,
          stagger: 0.08,
          ease: 'power3.out',
        })
        gsap.from('.val-slot', {
          scrollTrigger: { trigger: '.val-squad__grid', start: 'top 88%', once: true },
          y: 70,
          opacity: 0,
          duration: 0.8,
          stagger: 0.07,
          ease: 'power3.out',
        })
      })
    },
    { scope: root, dependencies: [intro.ready, replay], revertOnUpdate: true },
  )

  // Kilatan "LOCKED IN" setelah form dikirim.
  useGSAP(
    () => {
      if (!lockKey) return
      const mm = gsap.matchMedia()
      mm.add(MOTION_OK, () => {
        gsap
          .timeline()
          .fromTo('.val-locked', { autoAlpha: 1, clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.32, ease: 'power3.in' })
          .from('.val-locked__text', { scale: 1.25, duration: 0.5, ease: 'power4.out' }, '<0.2')
          .to('.val-locked', { clipPath: 'inset(0 0 0 100%)', duration: 0.4, ease: 'power3.inOut', delay: 0.55 })
          .set('.val-locked', { autoAlpha: 0 })
      })
    },
    { scope: root, dependencies: [lockKey] },
  )

  const slots = Array.from({ length: j.slots }, (_, i) => j.players[i] ?? null)
  const reserves = j.players.slice(j.slots)

  const copyLobby = async () => toast((await copyText(j.lobby)) ? `${def.lobbyLabel} disalin.` : 'Gagal menyalin.')

  return (
    <div className="val" data-variant={j.variant} ref={root}>
      {intro.show && <ValIntro headline={j.headline} onDone={intro.done} />}

      <header className="val-top">
        <a className="val-top__mark" href="#main" aria-label="Jarkoman, ke atas">
          JARKOMAN
        </a>
        <span className="val-top__game">{def.name}</span>
        <span className={`val-status val-status--${s.state}`}>{statusLabel(s)}</span>
        <button className="val-top__share" type="button" onClick={actions.share}>
          Bagikan
        </button>
      </header>

      <main id="main">
        <section className="val-hero" aria-labelledby="val-title">
          <div className="val-hero__bg" aria-hidden="true">
            <span className="val-hero__ghost">{j.map || def.name}</span>
            <div className="val-hero__art">
              <ArtImage game="valorant" custom={j.bg} className="val-hero__img" sizes={HERO_SIZES.valorant} priority />
            </div>
            <span className="val-hero__edge" />
          </div>

          <div className="val-hero__inner">
            <div className="val-hero__main">
              <p className="val-kicker">
                <span className="val-kicker__code">//</span> {[j.mode, j.map].filter(Boolean).join(' · ') || def.name}
              </p>
              <Split as="h1" id="val-title" className="val-hero__title" text={j.headline} by="chars" style={{ '--scale': scale } as CSSProperties} />
              {j.subline && <p className="val-hero__sub">{j.subline}</p>}
              <div className="val-hero__cta">
                <a className="val-btn val-btn--primary" href="#join">
                  <span>{isClosed(s) ? 'Tanya jadwal berikutnya' : def.cta}</span>
                </a>
                {!isClosed(s) && (
                  <button className="val-btn val-btn--ghost" type="button" onClick={actions.calendar}>
                    <span>Simpan ke kalender</span>
                  </button>
                )}
              </div>
            </div>

            <aside className="val-card" aria-label="Jadwal dan slot">
              <div className="val-card__date">
                <span className="val-card__dow">{date.dow}</span>
                <span className="val-card__day">{date.day}</span>
                <span className="val-card__month">
                  {date.month}
                  <br />
                  {date.year}
                </span>
              </div>
              <p className="val-card__time">{formatTimeRange(j)}</p>
              <ValCountdown s={s} />
              <SlotMeter total={j.slots} players={j.players} filled={s.filled} />
              <div className="val-squares" aria-hidden="true">
                {Array.from({ length: 6 }, (_, i) => (
                  <i key={i} />
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="val-intel" aria-labelledby="val-intel-title">
          <SectionTitle id="val-intel-title" index="01" text="Detail match" />
          <div className={`val-intel__layout ${j.map ? 'has-map' : ''}`}>
            {j.map && <MapPanel name={j.map} info={media?.mapInfo?.[j.map.toLowerCase()]} />}
            <dl className="val-intel__grid">
              {j.mode && <IntelItem code="MODE" value={j.mode} />}
              {j.rank && <IntelItem code="RANK" value={j.rank} />}
              <IntelItem code="JADWAL" value={`${formatDateLong(j.date)}, ${formatTimeRange(j)}`} small />
              {j.host && <IntelItem code="HOST" value={j.host} />}
              {j.lobby && (
                <IntelItem code={def.lobbyLabel.toUpperCase()} value={j.lobby} small>
                  <button type="button" className="val-mini" onClick={copyLobby}>
                    Salin
                  </button>
                </IntelItem>
              )}
              {j.voice && (
                <IntelItem code="VOICE" value="Discord / voice room" small>
                  <a className="val-mini" href={j.voice} target="_blank" rel="noopener noreferrer">
                    Masuk voice
                  </a>
                </IntelItem>
              )}
            </dl>
          </div>
        </section>

        <section className="val-squad" aria-labelledby="val-squad-title">
          <div className="val-squad__head">
            <SectionTitle id="val-squad-title" index="02" text="Skuad" />
            <p className="val-squad__count">
              <strong>{s.filled}</strong>/{j.slots} terkunci
              {s.full && <span className="val-squad__full"> · penuh</span>}
            </p>
          </div>
          <ol className="val-squad__grid" style={{ '--cols': Math.min(5, j.slots) } as CSSProperties}>
            {slots.map((p, i) => (
              <li key={p?.id ?? `empty-${i}`}>
                <SlotCard index={i} player={p} host={j.host} />
              </li>
            ))}
          </ol>
          {reserves.length > 0 && (
            <p className="val-squad__reserve">
              <span>Cadangan:</span> {reserves.map((r) => r.name).join(', ')}
            </p>
          )}
        </section>

        <section className="val-join" id="join" aria-labelledby="val-join-title">
          <div className="val-join__intro">
            <SectionTitle id="val-join-title" index="03" text={joinTitle(s, 'Kunci slot kamu')} />
            <p className="val-join__text">
              {j.autoJoin
                ? 'Isi nama dan role, lalu tekan LOCK IN. Nama kamu langsung terkunci di skuad tanpa perlu menunggu host.'
                : 'Isi nama dan role, lalu tekan tombolnya. WhatsApp terbuka dengan pesan konfirmasi yang sudah lengkap, host tinggal memasukkan kamu ke skuad.'}
            </p>
          </div>
          <JoinForm
            j={j}
            session={s}
            className="val-form"
            cta={
              <>
                <span>{def.cta}</span>
                <span className="val-form__cta-sub">{j.autoJoin ? 'langsung masuk skuad' : 'kirim ke WhatsApp'}</span>
              </>
            }
            renderRole={({ value, onChange, options, labelId }) => (
              <div className="chips val-chips" role="radiogroup" aria-labelledby={labelId}>
                {options.map((r) => (
                  <label className="chip val-chip" key={r}>
                    <input type="radio" name="val-role" value={r} checked={value === r} onChange={() => onChange(r)} />
                    <span>{r}</span>
                  </label>
                ))}
              </div>
            )}
            onSent={() => setLockKey((k) => k + 1)}
          />
        </section>

        {j.notes && (
          <section className="val-brief" aria-labelledby="val-brief-title">
            <SectionTitle id="val-brief-title" index="04" text="Briefing" />
            <ul className="val-brief__list">
              {j.notes
                .split('\n')
                .filter((l) => l.trim())
                .map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
            </ul>
          </section>
        )}

        <Schedule items={others} title="Jadwal lain" className="val-sched" />
      </main>

      <SiteFooter media={media} className="val-foot" />

      <MusicDock j={j} />

      <div className="val-locked" aria-hidden="true">
        <span className="val-locked__text">LOCKED IN</span>
      </div>
    </div>
  )
}

function SectionTitle({ id, index, text }: { id: string; index: string; text: string }) {
  return (
    <h2 className="val-title" id={id}>
      <span className="val-title__index">{index}</span>
      <span className="val-wipe">
        <span className="val-wipe__text">{text}</span>
        <span className="val-wipe__cover" aria-hidden="true" />
      </span>
    </h2>
  )
}

function IntelItem({ code, value, small, children }: { code: string; value: string; small?: boolean; children?: React.ReactNode }) {
  return (
    <div className="val-intel__item">
      <dt className="val-intel__code">{code}</dt>
      <dd className={`val-intel__value ${small ? 'is-small' : ''}`}>
        <span>{value}</span>
        {children}
      </dd>
    </div>
  )
}

/**
 * Kartu map ala layar loading VALORANT: splash map, nama raksasa, koordinat fiksi Riot, dan minimap
 * dengan penanda site serta spawn. Gambar dari valorant-api lewat /api/media; tanpa itu tetap tampil
 * sebagai panel tipografi.
 */
function MapPanel({ name, info }: { name: string; info?: MapMedia }) {
  const [splashFailed, setSplashFailed] = useState(false)
  const [miniFailed, setMiniFailed] = useState(false)
  const splash = info?.splash && !splashFailed ? info.splash : ''
  const mini = info?.minimap && !miniFailed ? info.minimap : ''
  const sites = info?.markers.filter((m) => m.kind === 'site').map((m) => m.label) ?? []
  return (
    <figure className={`val-map ${splash ? 'has-splash' : ''} ${mini ? 'has-mini' : ''}`} style={{ '--len': Math.max(name.length, 5) } as CSSProperties}>
      <div className="val-map__art" aria-hidden="true">
        {splash ? (
          <img className="val-map__splash" src={splash} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" onError={() => setSplashFailed(true)} />
        ) : (
          <span className="val-map__ghost">{name}</span>
        )}
      </div>
      {mini && (
        <div className="val-map__mini" aria-hidden="true">
          <img src={mini} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" onError={() => setMiniFailed(true)} />
          {info!.markers.map((m) => (
            <span key={`${m.kind}-${m.label}`} className={`val-map__mark val-map__mark--${m.kind}`} style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}>
              {m.label}
            </span>
          ))}
        </div>
      )}
      <figcaption className="val-map__cap">
        <span className="val-map__kicker">
          <span className="val-map__code">//</span> Map
          {info?.sites ? ` · ${info.sites}` : sites.length ? ` · Site ${sites.join('/')}` : ''}
        </span>
        <span className="val-map__name">{name}</span>
        {info?.coordinates && <span className="val-map__coords">{info.coordinates}</span>}
      </figcaption>
      <span className="val-map__wipe" aria-hidden="true" />
    </figure>
  )
}

function ValCountdown({ s }: { s: SessionInfo }) {
  if (s.state === 'cancelled' || s.state === 'ended' || s.state === 'unscheduled') {
    return <p className={`val-cd-state val-cd-state--${s.state}`}>{statusLabel(s)}</p>
  }
  const { days, hours, minutes, seconds } = s.parts
  const cells: [number, string][] = [
    [days, 'hari'],
    [hours, 'jam'],
    [minutes, 'menit'],
    [seconds, 'detik'],
  ]
  return (
    <div className="val-cd" role="timer" aria-label={s.state === 'live' ? 'Sisa waktu sesi' : 'Hitung mundur ke mulai'}>
      <p className="val-cd__label">{s.state === 'live' ? 'Lagi main · selesai dalam' : `Mulai ${s.rel} · dalam`}</p>
      <div className="val-cd__cells">
        {cells.map(([v, label]) => (
          <div className="val-cd__cell" key={label}>
            <Digits value={v} className="val-cd__num" />
            <span className="val-cd__unit">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SlotMeter({ total, players, filled }: { total: number; players: Player[]; filled: number }) {
  return (
    <div className="val-meter">
      <div className="val-meter__bar" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => {
          const p = players[i]
          return <span key={i} className={p ? (p.status === 'in' ? 'is-in' : 'is-maybe') : ''} />
        })}
      </div>
      <p className="val-meter__text">
        {filled}/{total} slot terisi
      </p>
    </div>
  )
}

function SlotCard({ index, player, host }: { index: number; player: Player | null; host: string }) {
  const { media } = usePage()
  const num = String(index + 1).padStart(2, '0')
  if (!player) {
    return (
      <a className="val-slot val-slot--empty" href="#join">
        <span className="val-slot__num">{num}</span>
        <span className="val-slot__plus" aria-hidden="true" />
        <span className="val-slot__empty-text">Slot kosong</span>
        <span className="val-slot__take">Ambil slot ini</span>
      </a>
    )
  }
  const agent = player.pick ? media?.agents?.[player.pick.toLowerCase()] : undefined
  const role = player.role || roleOfPick(def, player.pick) || ''
  const colors = agent?.colors?.length ? agent.colors : null
  const style = colors ? ({ '--a1': colors[0], '--a2': colors[1] ?? colors[0] } as CSSProperties) : undefined
  const isHost = host.trim() && host.trim().toLowerCase() === player.name.trim().toLowerCase()
  return (
    <article className={`val-slot ${colors ? 'has-agent' : ''} ${player.status === 'maybe' ? 'is-maybe' : ''}`} style={style}>
      <span className="val-slot__num">{num}</span>
      {agent?.portrait && <img className="val-slot__portrait" src={agent.portrait} alt="" loading="lazy" referrerPolicy="no-referrer" />}
      {!agent?.portrait && (
        <span className="val-slot__initial" aria-hidden="true">
          {player.name.slice(0, 1)}
        </span>
      )}
      <div className="val-slot__info">
        {isHost && <span className="val-slot__tag">Host</span>}
        {player.status === 'maybe' && <span className="val-slot__tag val-slot__tag--maybe">Belum pasti</span>}
        <h3 className="val-slot__name">{player.name}</h3>
        <p className="val-slot__role">{[role, player.pick].filter(Boolean).join(' · ') || 'Role bebas'}</p>
      </div>
    </article>
  )
}

function ValIntro({ headline, onDone }: { headline: string; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      const tl = gsap.timeline({ onComplete: onDone, defaults: { ease: 'power4.inOut' } })
      tl.from('.val-intro__bar', { xPercent: -101, duration: 0.55, stagger: 0.08 })
        .from('.val-intro__word', { yPercent: 110, duration: 0.5, ease: 'power4.out' }, 0.35)
        .to('.val-intro__word', { yPercent: -110, duration: 0.4, ease: 'power4.in' }, 1.05)
        .to('.val-intro__bar', { xPercent: 101, duration: 0.5, stagger: 0.06 }, 1.15)
        .to(ref.current, { autoAlpha: 0, duration: 0.2 }, '>-0.1')
    },
    { scope: ref },
  )
  return (
    <div className="intro val-intro" ref={ref}>
      <span className="val-intro__bar" aria-hidden="true" />
      <span className="val-intro__bar" aria-hidden="true" />
      <span className="val-intro__bar" aria-hidden="true" />
      <p className="val-intro__line" aria-hidden="true">
        <span className="val-intro__word">{headline}</span>
      </p>
      <button className="intro__skip" type="button" onClick={onDone}>
        Lewati intro
      </button>
    </div>
  )
}
