import { artThumb } from '../../shared/art'
import { gameDef } from '../../shared/games'
import { formatClock, formatDateShort, liveState, startEpoch } from '../../shared/time'
import type { Jarkoman, MediaPayload } from '../../shared/types'
import { playersIn } from '../../shared/wa'
import { downloadIcs, shareJarkoman } from './actions'
import { useNow } from './hooks'
import { useToast } from './Toast'

/** Tombol simpan ke kalender dan bagikan. Kelas tombol diatur tema. */
export function useActions(j: Jarkoman) {
  const toast = useToast()
  return {
    share: async () => {
      const msg = await shareJarkoman(j)
      if (msg) toast(msg)
    },
    calendar: () => toast(downloadIcs(j)),
  }
}

interface ScheduleProps {
  items: Jarkoman[]
  className?: string
  title: string
}

/** Jarkoman lain yang masih akan datang, urut dari yang paling dekat. */
export function Schedule({ items, className = '', title }: ScheduleProps) {
  const now = useNow(60_000)
  const upcoming = items
    .filter((i) => {
      const s = liveState(i, now)
      return s === 'upcoming' || s === 'live'
    })
    .sort((a, b) => (startEpoch(a) ?? 0) - (startEpoch(b) ?? 0))
    .slice(0, 6)
  if (upcoming.length === 0) return null
  return (
    <section className={`sched ${className}`} aria-labelledby="sched-title">
      <h2 className="sched__title" id="sched-title">
        {title}
      </h2>
      <ul className="sched__list">
        {upcoming.map((i) => {
          const def = gameDef(i.game)
          const live = liveState(i, now) === 'live'
          return (
            <li key={i.id}>
              <a className="sched__row" href={`/?id=${encodeURIComponent(i.id)}`} data-game={i.game}>
                <img className="sched__thumb" src={artThumb(i.game)} alt="" loading="lazy" width={96} height={54} style={{ viewTransitionName: `jk-art-${i.id}` }} />
                <span className="sched__game">{def.name}</span>
                <span className="sched__headline">{i.headline}</span>
                <span className="sched__when">{live ? 'Lagi main' : `${formatDateShort(i.date)} · ${formatClock(i.time)} ${i.tz}`}</span>
                <span className="sched__slots">
                  {playersIn(i)}/{i.slots}
                </span>
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function SiteFooter({ media, className = '' }: { media: MediaPayload | null; className?: string }) {
  return (
    <footer className={`site-foot ${className}`}>
      <p>
        Dibuat untuk ngajak teman mabar. Bukan situs resmi dan tidak berafiliasi dengan Riot Games, Valve, Moonton, atau semiwork. Nama dan aset game milik pemiliknya
        masing-masing.
        {media && (
          <>
            {' '}
            Gambar game dari{' '}
            <a href={media.sourceUrl} target="_blank" rel="noopener noreferrer">
              {media.source}
            </a>
            .
          </>
        )}
      </p>
      <a className="site-foot__admin" href="/admin/">
        Masuk admin
      </a>
    </footer>
  )
}
