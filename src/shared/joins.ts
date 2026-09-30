import { GAMES } from './games'
import { uid } from './ids'
import { cleanText, LIMITS } from './sanitize'
import { liveState, startEpoch } from './time'
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

/** Waktu pendaftaran ditutup (epoch ms), atau null kalau host tidak memasang batas. */
export function joinDeadline(j: Pick<Jarkoman, 'date' | 'time' | 'tz' | 'joinClose'>): number | null {
  if (!(j.joinClose >= 0)) return null
  const start = startEpoch(j)
  return start === null ? null : start - j.joinClose * 60_000
}

/** Kalimat batas pendaftaran untuk form dan pesan WA, misalnya "30 menit sebelum mulai (pukul 19.30 WIB)". */
export function joinCloseLabel(j: Pick<Jarkoman, 'time' | 'tz' | 'joinClose'>): string {
  if (!(j.joinClose >= 0)) return ''
  const m = /^(\d{2}):(\d{2})$/.exec(j.time)
  if (!m) return j.joinClose === 0 ? 'saat sesi dimulai' : `${j.joinClose} menit sebelum mulai`
  const total = (((Number(m[1]) * 60 + Number(m[2]) - j.joinClose) % 1440) + 1440) % 1440
  const clock = `${String(Math.floor(total / 60)).padStart(2, '0')}.${String(total % 60).padStart(2, '0')} ${j.tz}`
  return j.joinClose === 0 ? `saat sesi dimulai (pukul ${clock})` : `${j.joinClose} menit sebelum mulai (pukul ${clock})`
}

export function joinClosed(j: Jarkoman, now = Date.now()): boolean {
  const deadline = joinDeadline(j)
  return deadline !== null && now >= deadline
}

/**
 * Role yang masih kosong di skuad (bukan cadangan), mengikuti komposisi tim ideal game itu. Hanya dihitung kalau
 * jumlah slot cukup untuk satu tim penuh; untuk 2v2 atau skuad kecil petunjuk ini tidak bermakna.
 */
export function neededRoles(j: Jarkoman): string[] {
  const comp = GAMES[j.game].composition
  if (!comp || j.slots < comp.length) return []
  const inSquad = j.players.slice(0, j.slots)
  if (inSquad.length >= j.slots) return []
  const have = new Set(inSquad.map((p) => p.role))
  return comp.filter((r) => !have.has(r))
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
  if (joinClosed(item, now)) throw new JoinError('closed', 'Pendaftaran sudah ditutup host. Tanya host lewat WhatsApp kalau masih mau ikut.')
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
    editSeq: 0,
    joinedAt: now,
  }
  const next: Jarkoman = { ...item, players: [...item.players, player] }
  return {
    state: { ...state, joinSeq: seq, items: state.items.map((i) => (i.id === item.id ? next : i)) },
    item: next,
    player,
  }
}

export interface JoinPatch {
  role?: string
  pick?: string
  note?: string
}

/**
 * Pemain mengubah role, pick, atau catatannya sendiri tanpa kehilangan posisi di skuad. joinSeq naik dan editSeq
 * pemain diperbarui supaya perubahan ini ikut terbawa ke draft admin yang dibuka sebelumnya (lihat applyWebChanges).
 * seq (urutan daftar) tidak berubah, jadi pemain yang sudah dihapus admin di draft tidak ikut muncul lagi.
 */
export function updateWebPlayer(state: SiteState, itemId: string, playerId: string, patch: JoinPatch, now = Date.now()): { state: SiteState; item: Jarkoman; player: Player } {
  const item = state.items.find((i) => i.id === itemId)
  if (!item) throw new JoinError('not-found', 'Jarkoman ini sudah tidak ada.')
  const live = liveState(item, now)
  if (live === 'cancelled' || live === 'ended') throw new JoinError('closed', live === 'cancelled' ? 'Sesi ini dibatalkan.' : 'Sesi ini sudah selesai.')
  const current = item.players.find((p) => p.id === playerId)
  if (!current) throw new JoinError('not-found', 'Namamu sudah tidak ada di skuad. Mungkin dihapus host.')
  const def = GAMES[item.game]
  const role = patch.role === undefined ? current.role : cleanText(patch.role, LIMITS.short)
  const seq = state.joinSeq + 1
  const player: Player = {
    ...current,
    role: role === '' || def.roles.includes(role) ? role : current.role,
    pick: patch.pick === undefined ? current.pick : cleanText(patch.pick, LIMITS.short),
    note: patch.note === undefined ? current.note : cleanText(patch.note, LIMITS.playerNote),
    editSeq: seq,
  }
  const next: Jarkoman = { ...item, players: item.players.map((p) => (p.id === playerId ? player : p)) }
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
  const edited = new Map<string, Player>()
  for (const item of source.items) {
    const fresh = item.players.filter((p) => p.via === 'web' && p.seq > sinceSeq)
    if (fresh.length) joined.set(item.id, fresh)
    for (const p of item.players) if (p.via === 'web' && p.editSeq > sinceSeq) edited.set(`${item.id}:${p.id}`, p)
  }
  const items = target.items.map((item) => {
    let changed = false
    // Pemain yang mengubah role atau pick sendiri: perbarui field milik pemain saja (status dan urutan tetap milik
    // admin). Hanya untuk pemain yang masih ada di target; yang sudah dihapus admin tidak dimunculkan lagi.
    const kept = item.players
      .filter((p) => !removed.has(p.id))
      .map((p) => {
        const e = edited.get(`${item.id}:${p.id}`)
        if (!e || (e.role === p.role && e.pick === p.pick && e.note === p.note && e.editSeq === p.editSeq)) return p
        changed = true
        return { ...p, role: e.role, pick: e.pick, note: e.note, editSeq: e.editSeq }
      })
    const have = new Set(kept.map((p) => p.id))
    const add = (joined.get(item.id) ?? []).filter((p) => !have.has(p.id) && !kept.some((k) => sameName(k.name, p.name)))
    const players = [...kept, ...add].slice(0, LIMITS.players)
    return players.length === item.players.length && add.length === 0 && !changed ? item : { ...item, players }
  })
  const gone = new Map<string, number>()
  for (const g of [...target.gone, ...source.gone]) gone.set(g.id, Math.max(g.seq, gone.get(g.id) ?? 0))
  return {
    ...target,
    items,
    joinSeq: Math.max(target.joinSeq, source.joinSeq),
    gone: [...gone]
      .map(([id, seq]) => ({ id, seq }))
      .sort((a, b) => a.seq - b.seq)
      .slice(-LIMITS.gone),
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

/**
 * Catatan pemain ditulis untuk host, bukan untuk semua orang. Respons API publik (GET /api/state tanpa login,
 * respons /api/join) memakai versi ini; dashboard admin yang login tetap menerima catatan lengkap.
 */
export function publicItem(item: Jarkoman): Jarkoman {
  return item.players.some((p) => p.note) ? { ...item, players: item.players.map((p) => (p.note ? { ...p, note: '' } : p)) } : item
}

export function publicState(state: SiteState): SiteState {
  return { ...state, items: state.items.map(publicItem) }
}

/**
 * Admin tidak bisa mengubah catatan pemain, tapi draftnya bisa berasal dari bacaan tanpa catatan (sesi login habis
 * lalu login lagi). Saat menyimpan, catatan yang kosong di draft diambil dari data server supaya tidak terhapus.
 */
export function keepNotes(incoming: SiteState, current: SiteState): SiteState {
  const notes = new Map<string, string>()
  for (const item of current.items) for (const p of item.players) if (p.note) notes.set(`${item.id}:${p.id}`, p.note)
  if (!notes.size) return incoming
  return {
    ...incoming,
    items: incoming.items.map((item) => ({
      ...item,
      players: item.players.map((p) => (p.note ? p : { ...p, note: notes.get(`${item.id}:${p.id}`) ?? '' })),
    })),
  }
}
