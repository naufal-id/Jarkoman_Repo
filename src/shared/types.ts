export type GameId = 'valorant' | 'cs2' | 'mlbb' | 'repo'
export const GAME_IDS: readonly GameId[] = ['valorant', 'cs2', 'mlbb', 'repo']

export type Tz = 'WIB' | 'WITA' | 'WIT'
export const TZS: readonly Tz[] = ['WIB', 'WITA', 'WIT']

export type PlayerStatus = 'in' | 'maybe'

export interface Player {
  id: string
  name: string
  /** Valorant/CS2: role, MLBB: lane, R.E.P.O.: warna semibot */
  role: string
  /** Valorant: agent, CS2: senjata, MLBB: hero, R.E.P.O.: tugas */
  pick: string
  status: PlayerStatus
}

/** Status yang diset manual oleh admin. "Penuh", "sedang main", dan "selesai" dihitung otomatis dari data. */
export type ManualStatus = 'open' | 'cancelled' | 'done'

export interface Jarkoman {
  id: string
  game: GameId
  headline: string
  subline: string
  mode: string
  map: string
  rank: string
  lobby: string
  voice: string
  /** YYYY-MM-DD, di zona waktu `tz` */
  date: string
  /** HH:mm */
  time: string
  /** HH:mm, kosong berarti mulai + 3 jam */
  endTime: string
  tz: Tz
  host: string
  slots: number
  players: Player[]
  notes: string
  status: ManualStatus
  wa: string
  /** URL gambar utama pilihan admin, kosong = key art bawaan */
  bg: string
  variant: string
  /** '' = musik bawaan (orisinal, per game), 'none' = tanpa musik, atau URL file audio */
  music: string
  /** Judul lagu yang tampil saat musik diputar (untuk lagu upload/link) */
  musicLabel: string
  updatedAt: number
}

export interface SiteState {
  version: 1
  featuredId: string
  items: Jarkoman[]
  updatedAt: number
}

export interface StateResponse {
  state: SiteState | null
}

export interface MediaItem {
  url: string
  thumb?: string
  label: string
  kind: 'map' | 'art' | 'shot'
}

export interface AgentMedia {
  portrait?: string
  icon?: string
  colors?: string[]
  role?: string
}

export interface MediaPayload {
  game: GameId
  source: string
  sourceUrl: string
  hero?: string
  gallery: MediaItem[]
  maps?: Record<string, string>
  agents?: Record<string, AgentMedia>
}
