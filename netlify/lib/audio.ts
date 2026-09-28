import type { SiteState } from '../../src/shared/types'
import { audioStore } from './store'

/** Batas ukuran lagu upload. Request body Netlify Functions maksimal 6 MB. */
export const MAX_AUDIO_BYTES = 4.5 * 1024 * 1024

export const AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/webm', 'audio/wav', 'audio/x-wav', 'audio/flac']

/** File yang tidak dipakai jarkoman mana pun dihapus setelah umur ini (memberi waktu admin menyimpan). */
const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000

export function audioIdsIn(state: SiteState): Set<string> {
  const ids = new Set<string>()
  for (const item of state.items) {
    const match = /^\/api\/audio\?id=([a-z0-9]{8,40})$/.exec(item.music)
    if (match) ids.add(match[1])
  }
  return ids
}

/** Hapus lagu upload yang sudah tidak dipakai. Dipanggil setelah state disimpan; kegagalan diabaikan. */
export async function cleanupAudio(state: SiteState, now = Date.now()): Promise<number> {
  const used = audioIdsIn(state)
  const store = audioStore()
  let removed = 0
  for (const file of await store.list()) {
    if (used.has(file.key) || now - file.uploadedAt < ORPHAN_AGE_MS) continue
    await store.delete(file.key)
    removed++
  }
  return removed
}

/** Parse header Range "bytes=start-end" untuk satu rentang. */
export function parseRange(header: string | null, size: number): { start: number; end: number } | null | 'invalid' {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return 'invalid'
  let start: number
  let end: number
  if (match[1] === '' && match[2] === '') return 'invalid'
  if (match[1] === '') {
    const suffix = Number(match[2])
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(match[1])
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1)
  }
  if (start > end || start >= size) return 'invalid'
  return { start, end }
}
