import { GAMES } from './games'
import { uid } from './ids'
import { cleanText, LIMITS } from './sanitize'
import { liveState } from './time'
import type { Jarkoman, Player, SiteState } from './types'

export type JoinErrorCode = 'not-found' | 'manual' | 'closed' | 'list-full' | 'name-taken' | 'invalid'

export class JoinError extends Error {
  code: JoinErrorCode
  constructor(code: JoinErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

export interface JoinInput {
  id: string
  name: string
  role: string
  pick: string
  note: string
}

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase('id') === b.trim().toLocaleLowerCase('id')

/** Posisi pemain di skuad: nomor slot (mulai 1), atau null kalau masuk cadangan. */
export function slotOf(j: Pick<Jarkoman, 'players' | 'slots'>, playerId: string): number | null {
  const index = j.players.findIndex((p) => p.id === playerId)
  return index >= 0 && index < j.slots ? index + 1 : null
}

/**
 * Pemain mendaftar sendiri lewat halaman. Mengembalikan state baru dan pemain yang ditambahkan,
 * atau melempar JoinError. State asli tidak diubah.
 */
export function addWebPlayer(state: SiteState, input: JoinInput, now = Date.now()): { state: SiteState; item: Jarkoman; player: Player } {
  const item = state.items.find((i) => i.id === input.id)
  if (!item) throw new JoinError('not-found', 'Jarkoman ini sudah tidak ada.')
  if (!item.autoJoin) throw new JoinError('manual', 'Host mematikan pendaftaran langsung. Konfirmasi lewat WhatsApp.')
  const live = liveState(item, now)
  if (live === 'cancelled' || live === 'ended') throw new JoinError('closed', live === 'cancelled' ? 'Sesi ini dibatalkan.' : 'Sesi ini sudah selesai.')
  const name = cleanText(input.name, LIMITS.playerName)
  if (!name) throw new JoinError('invalid', 'Isi nama dulu.')
  if (item.players.some((p) => sameName(p.name, name))) {
    throw new JoinError('name-taken', `Nama "${name}" sudah ada di skuad. Pakai nama lain, atau hubungi host kalau itu kamu.`)
  }
  if (item.players.length >= LIMITS.players) throw new JoinError('list-full', 'Daftar pemain dan cadangan sudah penuh.')

  const def = GAMES[item.game]
  const role = cleanText(input.role, LIMITS.short)
  const seq = state.joinSeq + 1
  const player: Player = {
    id: uid(),
    name,
    role: def.roles.includes(role) ? role : '',
    pick: cleanText(input.pick, LIMITS.short),
    status: 'in',
    via: 'web',
    note: cleanText(input.note, LIMITS.playerNote),
    seq,
    joinedAt: now,
  }
  const next: Jarkoman = { ...item, players: [...item.players, player] }
  return {
    state: { ...state, joinSeq: seq, items: state.items.map((i) => (i.id === item.id ? next : i)) },
    item: next,
    player,
  }
}

/** Pemain membatalkan pendaftarannya sendiri. Jejaknya dicatat di `gone` supaya tidak muncul lagi dari draft admin lama. */
export function removeWebPlayer(state: SiteState, itemId: string, playerId: string): { state: SiteState; item: Jarkoman } {
  const item = state.items.find((i) => i.id === itemId)
  if (!item) throw new JoinError('not-found', 'Jarkoman ini sudah tidak ada.')
  const seq = state.joinSeq + 1
  const next: Jarkoman = { ...item, players: item.players.filter((p) => p.id !== playerId) }
  return {
    state: {
      ...state,
      joinSeq: seq,
      gone: [...state.gone, { id: playerId, seq }].slice(-LIMITS.gone),
      items: state.items.map((i) => (i.id === item.id ? next : i)),
    },
    item: next,
  }
}

/**
 * Menerapkan pendaftaran dan pembatalan lewat web yang terjadi setelah `sinceSeq` (dari `source`)
 * ke `target`. Dipakai server saat admin menyimpan draft yang dibuka sebelum ada pendaftar baru,
 * dan dipakai dashboard untuk menampilkan pendaftar baru tanpa membuang perubahan yang belum disimpan.
 */
export function applyWebChanges(target: SiteState, source: SiteState, sinceSeq: number): SiteState {
  const removed = new Set(source.gone.filter((g) => g.seq > sinceSeq).map((g) => g.id))
  const joined = new Map<string, Player[]>()
  for (const item of source.items) {
    const fresh = item.players.filter((p) => p.via === 'web' && p.seq > sinceSeq)
    if (fresh.length) joined.set(item.id, fresh)
  }
  const items = target.items.map((item) => {
    const kept = item.players.filter((p) => !removed.has(p.id))
    const have = new Set(kept.map((p) => p.id))
    const add = (joined.get(item.id) ?? []).filter((p) => !have.has(p.id) && !kept.some((k) => sameName(k.name, p.name)))
    const players = [...kept, ...add].slice(0, LIMITS.players)
    return players.length === item.players.length && add.length === 0 ? item : { ...item, players }
  })
  const gone = new Map<string, number>()
  for (const g of [...target.gone, ...source.gone]) gone.set(g.id, Math.max(g.seq, gone.get(g.id) ?? 0))
  return {
    ...target,
    items,
    joinSeq: Math.max(target.joinSeq, source.joinSeq),
    gone: [...gone].map(([id, seq]) => ({ id, seq })).sort((a, b) => a.seq - b.seq).slice(-LIMITS.gone),
  }
}

/** Pendaftar web baru di `source` yang belum ada di `target` (untuk notifikasi dashboard). */
export function newWebPlayers(target: SiteState, source: SiteState): { item: Jarkoman; player: Player }[] {
  const out: { item: Jarkoman; player: Player }[] = []
  for (const item of source.items) {
    const before = target.items.find((i) => i.id === item.id)
    const have = new Set(before?.players.map((p) => p.id) ?? [])
    for (const p of item.players) if (p.via === 'web' && p.seq > target.joinSeq && !have.has(p.id)) out.push({ item, player: p })
  }
  return out
}
