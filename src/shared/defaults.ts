import { GAMES } from './games'
import { uid } from './ids'
import { nextSaturday } from './time'
import type { GameId, Jarkoman, Player, SiteState } from './types'
import { DEFAULT_WA } from './wa'

/** Pemain baru dengan nilai bawaan (ditambahkan admin). */
export function blankPlayer(patch: Partial<Player> = {}): Player {
  return { id: uid(), name: '', role: '', pick: '', status: 'in', via: 'admin', note: '', seq: 0, joinedAt: 0, ...patch }
}

export function createJarkoman(game: GameId, now = Date.now()): Jarkoman {
  const def = GAMES[game]
  return {
    id: uid(),
    game,
    headline: def.defaultHeadline,
    subline: def.defaultSubline,
    mode: def.modes[0],
    map: def.maps[0],
    rank: def.ranks[0],
    lobby: '',
    voice: '',
    date: nextSaturday('WIB', now),
    time: '20:00',
    endTime: '23:00',
    tz: 'WIB',
    host: '',
    slots: def.defaultSlots,
    players: [],
    notes: '',
    status: 'open',
    wa: DEFAULT_WA,
    bg: '',
    variant: def.variants[0].id,
    music: '',
    musicLabel: '',
    autoJoin: true,
    updatedAt: now,
  }
}

/** State awal sebelum admin menyimpan apa pun. Halaman publik memberi label "contoh" untuk state ini. */
export function defaultState(now = Date.now()): SiteState {
  const first = createJarkoman('valorant', now)
  return { version: 1, featuredId: first.id, items: [first], updatedAt: 0, joinSeq: 0, gone: [] }
}

/** Pindah game: field yang spesifik game direset ke default game baru, field umum dipertahankan. */
export function switchGame(j: Jarkoman, game: GameId): Jarkoman {
  if (j.game === game) return j
  const from = GAMES[j.game]
  const to = GAMES[game]
  const keepHeadline = j.headline.trim() && j.headline !== from.defaultHeadline
  const keepSubline = j.subline.trim() && j.subline !== from.defaultSubline
  return {
    ...j,
    game,
    headline: keepHeadline ? j.headline : to.defaultHeadline,
    subline: keepSubline ? j.subline : to.defaultSubline,
    mode: to.modes.includes(j.mode) ? j.mode : to.modes[0],
    map: to.maps.includes(j.map) ? j.map : to.maps[0],
    rank: to.ranks.includes(j.rank) ? j.rank : to.ranks[0],
    slots: Math.min(to.slotLimit, j.slots === from.defaultSlots ? to.defaultSlots : j.slots),
    players: j.players.map((p) => ({
      ...p,
      role: to.roles.includes(p.role) ? p.role : '',
      pick: to.picks.includes(p.pick) ? p.pick : '',
    })),
    variant: to.variants[0].id,
    bg: '',
  }
}
