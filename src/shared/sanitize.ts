import { GAMES } from './games'
import { uid } from './ids'
import { parseDate, parseTime } from './time'
import { GAME_IDS, TZS } from './types'
import type { GameId, Jarkoman, ManualStatus, Player, SiteState, Tz } from './types'
import { DEFAULT_WA } from './wa'

export const LIMITS = {
  items: 40,
  players: 20,
  headline: 60,
  subline: 160,
  short: 48,
  lobby: 120,
  url: 600,
  host: 40,
  notes: 1500,
  playerName: 32,
} as const

type Loose = Record<string, unknown>

const isObj = (v: unknown): v is Loose => typeof v === 'object' && v !== null && !Array.isArray(v)

// Karakter kontrol (kecuali baris baru dan tab) dibuang supaya teks aman ditampilkan di mana pun.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

export function cleanText(v: unknown, max: number, multiline = false): string {
  if (typeof v !== 'string' && typeof v !== 'number') return ''
  let s = String(v).replace(CONTROL, '')
  s = multiline ? s.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n') : s.replace(/\s+/g, ' ')
  s = s.trim()
  return s.length > max ? s.slice(0, max).trim() : s
}

export function cleanUrl(v: unknown): string {
  const s = cleanText(v, LIMITS.url)
  if (!s) return ''
  try {
    const url = new URL(s)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return ''
    return url.toString()
  } catch {
    return ''
  }
}

export const AUDIO_PATH = /^\/api\/audio\?id=[a-z0-9]{8,40}$/

/** '' (musik bawaan), 'none', file upload (/api/audio?id=...), atau URL http/https. */
export function cleanMusic(v: unknown): string {
  if (v === 'none') return 'none'
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return ''
  if (AUDIO_PATH.test(s)) return s
  return cleanUrl(s)
}

const cleanId = (v: unknown) => {
  const s = typeof v === 'string' ? v.toLowerCase() : ''
  return /^[a-z0-9-]{4,40}$/.test(s) ? s : uid()
}

function cleanPlayer(v: unknown): Player | null {
  if (!isObj(v)) return null
  const name = cleanText(v.name, LIMITS.playerName)
  if (!name) return null
  return {
    id: cleanId(v.id),
    name,
    role: cleanText(v.role, LIMITS.short),
    pick: cleanText(v.pick, LIMITS.short),
    status: v.status === 'maybe' ? 'maybe' : 'in',
  }
}

export function cleanJarkoman(v: unknown, now = Date.now()): Jarkoman | null {
  if (!isObj(v)) return null
  const game: GameId = GAME_IDS.includes(v.game as GameId) ? (v.game as GameId) : 'valorant'
  const def = GAMES[game]
  const tz: Tz = TZS.includes(v.tz as Tz) ? (v.tz as Tz) : 'WIB'
  const status: ManualStatus = v.status === 'cancelled' || v.status === 'done' ? v.status : 'open'
  const date = typeof v.date === 'string' && parseDate(v.date) ? v.date : ''
  const time = typeof v.time === 'string' && parseTime(v.time) ? v.time : '20:00'
  const endTime = typeof v.endTime === 'string' && parseTime(v.endTime) ? v.endTime : ''
  const slotsRaw = Math.round(Number(v.slots))
  const slots = Number.isFinite(slotsRaw) ? Math.min(def.slotLimit, Math.max(1, slotsRaw)) : def.defaultSlots
  const players = (Array.isArray(v.players) ? v.players : [])
    .map(cleanPlayer)
    .filter((p): p is Player => p !== null)
    .slice(0, LIMITS.players)
  const variant = def.variants.some((x) => x.id === v.variant) ? String(v.variant) : def.variants[0].id
  const wa = cleanText(v.wa, 24).replace(/[^\d+]/g, '')
  const updatedAt = Number(v.updatedAt)

  if (!date) return null

  return {
    id: cleanId(v.id),
    game,
    headline: cleanText(v.headline, LIMITS.headline) || def.defaultHeadline,
    subline: cleanText(v.subline, LIMITS.subline),
    mode: cleanText(v.mode, LIMITS.short),
    map: cleanText(v.map, LIMITS.short),
    rank: cleanText(v.rank, LIMITS.short),
    lobby: cleanText(v.lobby, LIMITS.lobby),
    voice: cleanUrl(v.voice),
    date,
    time,
    endTime,
    tz,
    host: cleanText(v.host, LIMITS.host),
    slots,
    players,
    notes: cleanText(v.notes, LIMITS.notes, true),
    status,
    wa: wa.replace(/\D/g, '').length >= 9 ? wa : DEFAULT_WA,
    bg: cleanUrl(v.bg),
    variant,
    music: cleanMusic(v.music),
    musicLabel: cleanText(v.musicLabel, 60),
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : now,
  }
}

export interface CleanResult {
  state: SiteState
  dropped: number
}

/** Validasi penuh state dari luar (body request, file impor). Item rusak dibuang, bukan disimpan setengah jadi. */
export function cleanState(v: unknown, now = Date.now()): CleanResult | null {
  if (!isObj(v) || !Array.isArray(v.items)) return null
  const raw = v.items.slice(0, LIMITS.items)
  const seen = new Set<string>()
  const items: Jarkoman[] = []
  for (const entry of raw) {
    const item = cleanJarkoman(entry, now)
    if (!item) continue
    if (seen.has(item.id)) item.id = uid()
    seen.add(item.id)
    items.push(item)
  }
  const featured = typeof v.featuredId === 'string' && seen.has(v.featuredId) ? v.featuredId : (items[0]?.id ?? '')
  const updatedAt = Number(v.updatedAt)
  return {
    state: { version: 1, featuredId: featured, items, updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0 },
    dropped: v.items.length - items.length,
  }
}
