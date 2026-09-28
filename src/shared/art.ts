import type { GameId } from './types'

export interface KeyArt {
  src: string
  w: number
  h: number
  /** Versi kecil untuk layar sempit (opsional) */
  small?: string
  smallW?: number
  /** Nama yang dipakai di admin */
  label: string
}

/** Key art resmi tiap game (dari host), disimpan di public/games sebagai WebP. */
export const KEY_ART: Record<GameId, KeyArt> = {
  valorant: { src: '/games/valorant.webp', w: 1440, h: 811, small: '/games/valorant-800.webp', smallW: 800, label: 'Key art VALORANT' },
  cs2: { src: '/games/cs2.webp', w: 616, h: 353, label: 'Key art Counter-Strike 2' },
  mlbb: { src: '/games/mlbb.webp', w: 1170, h: 655, small: '/games/mlbb-720.webp', smallW: 720, label: 'Poster Mobile Legends: Bang Bang' },
  repo: { src: '/games/repo.webp', w: 460, h: 215, label: 'Key art R.E.P.O.' },
}

export function artSrcSet(game: GameId): string | undefined {
  const a = KEY_ART[game]
  return a.small && a.smallW ? `${a.small} ${a.smallW}w, ${a.src} ${a.w}w` : undefined
}

export function artThumb(game: GameId): string {
  return KEY_ART[game].small ?? KEY_ART[game].src
}
