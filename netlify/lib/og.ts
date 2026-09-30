import type { SiteState } from '../../src/shared/types'
import { ogStore } from './store'

export const OG_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_OG_BYTES = 700 * 1024
export const OG_SIG = /^[a-z0-9]{4,40}$/

/** Hapus gambar OG milik jarkoman yang sudah tidak ada. Dipanggil setelah admin menyimpan. */
export async function cleanupOg(state: SiteState): Promise<number> {
  const ids = new Set(state.items.map((i) => i.id))
  const store = ogStore()
  let removed = 0
  for (const file of await store.list()) {
    if (ids.has(file.key)) continue
    await store.delete(file.key)
    removed++
  }
  return removed
}
