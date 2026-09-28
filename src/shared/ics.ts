import { gameDef } from './games'
import { endEpoch, startEpoch } from './time'
import type { Jarkoman } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

export function icsStamp(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

/** Baris iCalendar maksimal 75 oktet, sisanya dilipat dengan spasi di awal baris lanjutan. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const out: string[] = []
  let current = ''
  let size = 0
  for (const ch of line) {
    const len = new TextEncoder().encode(ch).length
    const limit = out.length === 0 ? 75 : 74
    if (size + len > limit) {
      out.push(current)
      current = ''
      size = 0
    }
    current += ch
    size += len
  }
  out.push(current)
  return out.join('\r\n ')
}

export function buildIcs(j: Jarkoman, link: string, now = Date.now()): string | null {
  const start = startEpoch(j)
  const end = endEpoch(j)
  if (start === null || end === null) return null
  const def = gameDef(j.game)
  const summary = `${def.name}: ${j.headline}`
  const description = [
    j.subline,
    j.mode && `Mode: ${j.mode}`,
    j.map && `${def.mapLabel}: ${j.map}`,
    j.rank && `${def.rankLabel}: ${j.rank}`,
    j.lobby && `${def.lobbyLabel}: ${j.lobby}`,
    j.voice && `Voice: ${j.voice}`,
    link && `Jarkoman: ${link}`,
  ]
    .filter(Boolean)
    .join('\n')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Jarkoman//Mabar//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${j.id}@jarkoman`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    ...(link ? [`URL:${link}`] : []),
    j.status === 'cancelled' ? 'STATUS:CANCELLED' : 'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(`${def.name} mulai 30 menit lagi`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}
