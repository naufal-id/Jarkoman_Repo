import { drawOg, type OgContent } from '../src/admin/og-card'
import type { GameId } from '../src/shared/types'

/** Isi gambar bawaan per game: dipakai kalau jarkoman belum punya gambar khusus. Berlaku untuk kedua mode pendaftaran. */
const DEFAULTS: Record<GameId, OgContent> = {
  valorant: {
    game: 'valorant',
    variant: 'ink',
    kicker: 'VALORANT · mabar',
    title: 'Ajakan mabar',
    lines: ['Cek jadwal dan slot yang masih kosong', 'Pilih role dan agent andalan'],
    cta: 'LOCK IN',
    ctaNote: 'Kunci slotmu di halaman',
  },
  cs2: {
    game: 'cs2',
    variant: 't',
    kicker: 'Counter-Strike 2 · mabar',
    title: 'Ajakan mabar',
    lines: ['Cek jadwal dan slot yang masih kosong', 'Pilih role dan senjata andalan'],
    cta: 'SIAP TEMPUR',
    ctaNote: 'Kunci slotmu di halaman',
  },
  mlbb: {
    game: 'mlbb',
    variant: 'blue',
    kicker: 'Mobile Legends · mabar',
    title: 'Mabar bareng',
    lines: ['Cek jadwal dan lane yang masih kosong'],
    cta: 'GAS MABAR',
    ctaNote: 'Kunci slotmu di halaman',
  },
  repo: {
    game: 'repo',
    variant: 'senter',
    kicker: 'R.E.P.O. · mabar',
    title: 'Semibot dicari',
    lines: ['Cek jadwal dan kuota yang masih kosong', 'Pilih warna dan tugasmu'],
    cta: 'NAIK TRUK',
    ctaNote: 'Kunci slotmu di halaman',
  },
}

declare global {
  interface Window {
    renderOg: (game: GameId) => Promise<string>
  }
}

window.renderOg = async (game) => (await drawOg(DEFAULTS[game])).toDataURL('image/jpeg', 0.88)
