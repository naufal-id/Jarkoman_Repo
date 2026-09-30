import type { GameId } from './types'

export interface Variant {
  id: string
  label: string
}

export interface GameDef {
  id: GameId
  name: string
  fullName: string
  publisher: string
  /** Slot default saat jarkoman baru dibuat */
  defaultSlots: number
  /** Batas slot maksimal */
  slotLimit: number
  modes: string[]
  mapLabel: string
  maps: string[]
  rankLabel: string
  ranks: string[]
  roleLabel: string
  roles: string[]
  pickLabel: string
  picks: string[]
  /** Pilihan pick per role, dipakai Valorant (agent per role) */
  picksByRole?: Record<string, string[]>
  /** Role yang idealnya ada di satu tim penuh, untuk petunjuk "tim masih butuh" di form */
  composition?: string[]
  cta: string
  defaultHeadline: string
  defaultSubline: string
  variants: Variant[]
  /** Warna aksen untuk chrome admin dan meta theme-color */
  accent: string
  themeColor: string
  lobbyLabel: string
  lobbyPlaceholder: string
}

const VALORANT_AGENTS: Record<string, string[]> = {
  Duelist: ['Jett', 'Phoenix', 'Reyna', 'Raze', 'Yoru', 'Neon', 'Iso', 'Waylay'],
  Initiator: ['Sova', 'Breach', 'Skye', 'KAY/O', 'Fade', 'Gekko', 'Tejo'],
  Controller: ['Brimstone', 'Viper', 'Omen', 'Astra', 'Harbor', 'Clove', 'Miks'],
  Sentinel: ['Sage', 'Cypher', 'Killjoy', 'Chamber', 'Deadlock', 'Vyse', 'Veto'],
}

// prettier-ignore
const MLBB_HEROES = [
  'Aamon', 'Akai', 'Aldous', 'Alice', 'Alpha', 'Alucard', 'Angela', 'Argus', 'Arlott', 'Atlas', 'Aurora',
  'Badang', 'Balmond', 'Bane', 'Barats', 'Baxia', 'Beatrix', 'Belerick', 'Benedetta', 'Brody', 'Bruno',
  'Carmilla', 'Cecilion', "Chang'e", 'Chip', 'Chou', 'Cici', 'Claude', 'Clint', 'Cyclops', 'Diggie',
  'Dyrroth', 'Edith', 'Esmeralda', 'Estes', 'Eudora', 'Fanny', 'Faramis', 'Floryn', 'Franco', 'Fredrinn',
  'Freya', 'Gatotkaca', 'Gloo', 'Gord', 'Granger', 'Grock', 'Guinevere', 'Gusion', 'Hanabi', 'Hanzo',
  'Harith', 'Harley', 'Hayabusa', 'Helcurt', 'Hilda', 'Hylos', 'Irithel', 'Ixia', 'Jawhead', 'Johnson',
  'Joy', 'Julian', 'Kadita', 'Kagura', 'Kaja', 'Karina', 'Karrie', 'Khaleed', 'Khufra', 'Kimmy',
  'Lancelot', 'Lapu-Lapu', 'Layla', 'Leomord', 'Lesley', 'Ling', 'Lolita', 'Lukas', 'Lunox', 'Luo Yi',
  'Lylia', 'Martis', 'Masha', 'Mathilda', 'Melissa', 'Minotaur', 'Minsitthar', 'Miya', 'Moskov', 'Nana',
  'Natalia', 'Natan', 'Nolan', 'Novaria', 'Odette', 'Paquito', 'Pharsa', 'Phoveus', 'Popol and Kupa',
  'Rafaela', 'Roger', 'Ruby', 'Saber', 'Selena', 'Silvanna', 'Sun', 'Suyou', 'Terizla', 'Thamuz',
  'Tigreal', 'Uranus', 'Vale', 'Valentina', 'Valir', 'Vexana', 'Wanwan', 'X.Borg', 'Xavier', 'Yi Sun-shin',
  'Yin', 'Yu Zhong', 'Yve', 'Zhask', 'Zhuxin', 'Zilong',
]

export const REPO_COLORS: Record<string, string> = {
  Kuning: '#F5C518',
  Oranye: '#FF8A1F',
  Merah: '#E8412F',
  Pink: '#FF6FB1',
  Ungu: '#9B6BFF',
  Biru: '#3D8BFF',
  Toska: '#22C9B7',
  Hijau: '#58C94A',
  Putih: '#E9E6DF',
  Abu: '#8C8C94',
  Cokelat: '#A0693F',
}

export const GAMES: Record<GameId, GameDef> = {
  valorant: {
    id: 'valorant',
    name: 'VALORANT',
    fullName: 'VALORANT',
    publisher: 'Riot Games',
    defaultSlots: 5,
    slotLimit: 10,
    modes: ['Competitive', 'Unrated', 'Swiftplay', 'Premier', 'Spike Rush', 'Deathmatch', 'Team Deathmatch', 'Escalation', 'Custom'],
    mapLabel: 'Map',
    maps: ['Ascent', 'Bind', 'Haven', 'Split', 'Icebox', 'Breeze', 'Fracture', 'Pearl', 'Lotus', 'Sunset', 'Abyss', 'Corrode', 'Summit'],
    rankLabel: 'Rank',
    ranks: ['Semua rank', 'Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'],
    roleLabel: 'Role',
    roles: ['Duelist', 'Initiator', 'Controller', 'Sentinel', 'Flex'],
    composition: ['Duelist', 'Initiator', 'Controller', 'Sentinel'],
    pickLabel: 'Agent',
    picks: Object.values(VALORANT_AGENTS).flat(),
    picksByRole: VALORANT_AGENTS,
    cta: 'LOCK IN',
    defaultHeadline: 'Mabar Malam Minggu',
    defaultSubline: 'Satu slot kosong nggak bakal ngisi dirinya sendiri.',
    variants: [
      { id: 'ink', label: 'Ink (gelap)' },
      { id: 'bone', label: 'Bone (terang)' },
    ],
    accent: '#FF4655',
    themeColor: '#0F1923',
    lobbyLabel: 'Party code',
    lobbyPlaceholder: 'Contoh: kode party atau "invite by Riot ID"',
  },
  cs2: {
    id: 'cs2',
    name: 'CS2',
    fullName: 'Counter-Strike 2',
    publisher: 'Valve',
    defaultSlots: 5,
    slotLimit: 10,
    modes: ['Premier', 'Competitive', 'Wingman', 'Casual', 'Deathmatch', 'Arms Race', 'Retakes', 'Custom 5v5'],
    mapLabel: 'Map',
    maps: ['Ancient', 'Anubis', 'Dust II', 'Inferno', 'Mirage', 'Nuke', 'Overpass', 'Train', 'Cache', 'Vertigo', 'Office', 'Italy'],
    rankLabel: 'Rank',
    ranks: [
      'Semua rank',
      'Premier Gray (0+)',
      'Premier Light Blue (5.000+)',
      'Premier Blue (10.000+)',
      'Premier Purple (15.000+)',
      'Premier Pink (20.000+)',
      'Premier Red (25.000+)',
      'Premier Yellow (30.000+)',
      'Silver',
      'Gold Nova',
      'Master Guardian',
      'Legendary Eagle',
      'Supreme Master First Class',
      'The Global Elite',
    ],
    roleLabel: 'Role',
    roles: ['Entry', 'AWPer', 'Support', 'Lurker', 'IGL', 'Rifler'],
    composition: ['Entry', 'AWPer', 'Support', 'Lurker', 'IGL'],
    pickLabel: 'Senjata andalan',
    picks: ['AK-47', 'M4A4', 'M4A1-S', 'AWP', 'Desert Eagle', 'Galil AR', 'FAMAS', 'SSG 08', 'MP9', 'MAC-10', 'P90', 'Nova', 'USP-S', 'Glock-18'],
    cta: 'SIAP TEMPUR',
    defaultHeadline: 'Push B Bareng',
    defaultSubline: 'Freeze time sudah jalan. Tinggal kamu yang belum beli.',
    variants: [
      { id: 't', label: 'Terrorist (gold)' },
      { id: 'ct', label: 'Counter-Terrorist (biru)' },
    ],
    accent: '#EDA338',
    themeColor: '#0E1114',
    lobbyLabel: 'Server / lobby',
    lobbyPlaceholder: 'Contoh: connect 1.2.3.4:27015 atau "invite Steam"',
  },
  mlbb: {
    id: 'mlbb',
    name: 'MLBB',
    fullName: 'Mobile Legends: Bang Bang',
    publisher: 'Moonton',
    defaultSlots: 5,
    slotLimit: 10,
    modes: ['Ranked', 'Classic', 'Brawl', 'Custom 5v5', 'Arcade'],
    mapLabel: 'Format',
    maps: ['Draft Pick', 'Blind Pick'],
    rankLabel: 'Rank',
    ranks: ['Semua rank', 'Warrior', 'Elite', 'Master', 'Grandmaster', 'Epic', 'Legend', 'Mythic', 'Mythical Honor', 'Mythical Glory', 'Mythical Immortal'],
    roleLabel: 'Lane',
    roles: ['EXP Lane', 'Gold Lane', 'Mid Lane', 'Jungle', 'Roam'],
    composition: ['EXP Lane', 'Gold Lane', 'Mid Lane', 'Jungle', 'Roam'],
    pickLabel: 'Hero andalan',
    picks: MLBB_HEROES,
    cta: 'GAS MABAR',
    defaultHeadline: 'Push Rank Bareng',
    defaultSubline: 'Lima orang, satu tujuan: bintang naik, bukan turun.',
    variants: [
      { id: 'blue', label: 'Blue side' },
      { id: 'red', label: 'Red side' },
    ],
    accent: '#F0C45C',
    themeColor: '#070B1C',
    lobbyLabel: 'Room / ID host',
    lobbyPlaceholder: 'Contoh: ID host 12345678 (1234)',
  },
  repo: {
    id: 'repo',
    name: 'R.E.P.O.',
    fullName: 'R.E.P.O.',
    publisher: 'semiwork',
    defaultSlots: 6,
    slotLimit: 6,
    modes: ['Run baru', 'Lanjut save', 'Santai', 'Modded'],
    mapLabel: 'Level',
    maps: ['Acak', 'Swiftbroom Academy', 'Headman Manor', 'McJannek Station', 'Museum of Human Art'],
    rankLabel: 'Target',
    ranks: ['Bebas', 'Sampai level 5', 'Sampai level 10', 'Sampai level 15', 'Sampai level 20+'],
    roleLabel: 'Warna semibot',
    roles: Object.keys(REPO_COLORS),
    pickLabel: 'Tugas',
    picks: ['Pengangkut barang', 'Pengintai', 'Penjaga truk', 'Pengalih monster', 'Bebas'],
    cta: 'NAIK TRUK',
    defaultHeadline: 'Shift Malam',
    defaultSubline: 'Taxman butuh kuota. Kita butuh orang yang berani pegang barang pecah belah.',
    variants: [
      { id: 'senter', label: 'Senter (gelap)' },
      { id: 'lampu', label: 'Lampu nyala (terang)' },
    ],
    accent: '#F5B82E',
    themeColor: '#0B0A0C',
    lobbyLabel: 'Lobby',
    lobbyPlaceholder: 'Contoh: join lewat Steam host',
  },
}

export function gameDef(id: GameId): GameDef {
  return GAMES[id] ?? GAMES.valorant
}

/** Pilihan pick yang relevan untuk role tertentu (Valorant memfilter agent per role). */
export function picksFor(def: GameDef, role: string): string[] {
  if (def.picksByRole && def.picksByRole[role]) return def.picksByRole[role]
  return def.picks
}

/** Mencari role Valorant dari nama agent, dipakai saat pemain hanya mengisi agent. */
export function roleOfPick(def: GameDef, pick: string): string | undefined {
  if (!def.picksByRole) return undefined
  const found = Object.entries(def.picksByRole).find(([, list]) => list.includes(pick))
  return found?.[0]
}
