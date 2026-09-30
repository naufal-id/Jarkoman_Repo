import { api } from '../shared/api'
import type { SiteState } from '../shared/types'
import { drawOg, ogContentFor, ogVersion, toJpeg } from './og-card'

let queue: Promise<unknown> = Promise.resolve()
let generation = 0

/**
 * Buat ulang gambar preview link untuk jarkoman yang isinya berubah (atau belum punya gambar), satu per satu supaya
 * tidak membebani browser. Panggilan berurutan (antrean), dan panggilan lama berhenti kalau sudah ada yang lebih baru,
 * jadi gambar lama tidak pernah menimpa gambar baru. Gagal di satu jarkoman tidak menghentikan yang lain.
 */
export function syncOgImages(state: SiteState, token: string): Promise<number> {
  const mine = ++generation
  const run = async () => {
    let made = 0
    for (const item of state.items) {
      if (mine !== generation) break
      try {
        const version = ogVersion(item)
        const { sig: current } = await api.ogMeta(item.id)
        if (current === version) continue
        const blob = await toJpeg(await drawOg(ogContentFor(item)))
        if (mine !== generation) break
        await api.uploadOg(item.id, version, blob, token)
        made++
      } catch (err) {
        console.warn('[og] gambar preview gagal dibuat untuk', item.id, err)
      }
    }
    return made
  }
  const next = queue.then(run, run)
  queue = next.catch(() => null)
  return next
}
