import type { Jarkoman, Tz } from './types'

export const TZ_OFFSET_HOURS: Record<Tz, number> = { WIB: 7, WITA: 8, WIT: 9 }

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const DAYS_SHORT = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB']
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES']

export const DEFAULT_DURATION_MS = 3 * 60 * 60 * 1000

interface DateParts {
  y: number
  m: number
  d: number
}

export function parseDate(date: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  const probe = new Date(Date.UTC(y, m - 1, d))
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null
  return { y, m, d }
}

export function parseTime(time: string): { h: number; min: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time)
  if (!match) return null
  const h = Number(match[1])
  const min = Number(match[2])
  if (h > 23 || min > 59) return null
  return { h, min }
}

/** Epoch (ms) waktu mulai, dihitung dari tanggal + jam lokal zona Indonesia. */
export function startEpoch(j: Pick<Jarkoman, 'date' | 'time' | 'tz'>): number | null {
  const d = parseDate(j.date)
  const t = parseTime(j.time)
  if (!d || !t) return null
  const offset = TZ_OFFSET_HOURS[j.tz] ?? 7
  return Date.UTC(d.y, d.m - 1, d.d, t.h, t.min) - offset * 3600_000
}

/** Epoch (ms) waktu selesai. Jam selesai lebih kecil dari jam mulai berarti lewat tengah malam. */
export function endEpoch(j: Pick<Jarkoman, 'date' | 'time' | 'tz' | 'endTime'>): number | null {
  const start = startEpoch(j)
  if (start === null) return null
  const t = parseTime(j.endTime)
  if (!t) return start + DEFAULT_DURATION_MS
  const offset = TZ_OFFSET_HOURS[j.tz] ?? 7
  const d = parseDate(j.date)!
  let end = Date.UTC(d.y, d.m - 1, d.d, t.h, t.min) - offset * 3600_000
  if (end <= start) end += 24 * 3600_000
  return end
}

export type LiveState = 'upcoming' | 'live' | 'ended' | 'cancelled' | 'unscheduled'

export function liveState(j: Jarkoman, now: number): LiveState {
  if (j.status === 'cancelled') return 'cancelled'
  if (j.status === 'done') return 'ended'
  const start = startEpoch(j)
  const end = endEpoch(j)
  if (start === null || end === null) return 'unscheduled'
  if (now < start) return 'upcoming'
  if (now < end) return 'live'
  return 'ended'
}

export interface CountdownParts {
  days: number
  hours: number
  minutes: number
  seconds: number
  total: number
}

export function countdownParts(ms: number): CountdownParts {
  const total = Math.max(0, ms)
  const s = Math.floor(total / 1000)
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    total,
  }
}

export const pad2 = (n: number) => String(n).padStart(2, '0')

function weekday(p: DateParts): number {
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()
}

/** "Sabtu, 4 Oktober 2026" */
export function formatDateLong(date: string): string {
  const p = parseDate(date)
  if (!p) return 'Tanggal belum diatur'
  return `${DAYS[weekday(p)]}, ${p.d} ${MONTHS[p.m - 1]} ${p.y}`
}

/** "4 Okt" */
export function formatDateShort(date: string): string {
  const p = parseDate(date)
  if (!p) return '-'
  const m = MONTHS[p.m - 1]
  return `${p.d} ${m.slice(0, 3)}`
}

export function dayName(date: string): string {
  const p = parseDate(date)
  return p ? DAYS[weekday(p)] : ''
}

export function dateBlocks(date: string): { dow: string; day: string; month: string; year: string } {
  const p = parseDate(date)
  if (!p) return { dow: '---', day: '--', month: '---', year: '----' }
  return { dow: DAYS_SHORT[weekday(p)], day: pad2(p.d), month: MONTHS_SHORT[p.m - 1], year: String(p.y) }
}

/** "20.00" (format jam Indonesia memakai titik) */
export function formatClock(time: string): string {
  const t = parseTime(time)
  return t ? `${pad2(t.h)}.${pad2(t.min)}` : '--.--'
}

/** "20.00 sampai 23.00 WIB" atau "20.00 WIB" */
export function formatTimeRange(j: Pick<Jarkoman, 'time' | 'endTime' | 'tz'>): string {
  const start = formatClock(j.time)
  if (parseTime(j.endTime)) return `${start} sampai ${formatClock(j.endTime)} ${j.tz}`
  return `${start} ${j.tz}`
}

/** Tanggal (YYYY-MM-DD) hari ini di zona tertentu. */
export function todayIn(tz: Tz, now: number): string {
  const shifted = new Date(now + (TZ_OFFSET_HOURS[tz] ?? 7) * 3600_000)
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`
}

/** Sabtu terdekat yang belum lewat jam 20.00 di zona tertentu, dipakai untuk jarkoman baru. */
export function nextSaturday(tz: Tz, now: number): string {
  const shifted = new Date(now + (TZ_OFFSET_HOURS[tz] ?? 7) * 3600_000)
  const dow = shifted.getUTCDay()
  let add = (6 - dow + 7) % 7
  if (add === 0 && shifted.getUTCHours() >= 20) add = 7
  const target = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + add))
  return `${target.getUTCFullYear()}-${pad2(target.getUTCMonth() + 1)}-${pad2(target.getUTCDate())}`
}

/** Label relatif singkat: "hari ini", "besok", "3 hari lagi". */
export function relativeDay(j: Pick<Jarkoman, 'date' | 'tz'>, now: number): string {
  const p = parseDate(j.date)
  if (!p) return ''
  const today = parseDate(todayIn(j.tz, now))!
  const diff = Math.round((Date.UTC(p.y, p.m - 1, p.d) - Date.UTC(today.y, today.m - 1, today.d)) / 86400_000)
  if (diff === 0) return 'hari ini'
  if (diff === 1) return 'besok'
  if (diff === -1) return 'kemarin'
  if (diff > 1) return `${diff} hari lagi`
  return `${-diff} hari lalu`
}
