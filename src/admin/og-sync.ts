import { api } from '../shared/api'
import type { SiteState } from '../shared/types'
import { drawOg, ogContentFor, ogSignature, toJpeg } from './og-card'

/**
 * Buat ulang gambar preview link untuk jarkoman yang isinya berubah (atau belum punya gambar), satu per satu supaya
 * tidak membebani browser. Gagal di satu jarkoman tidak menghentikan yang lain; preview tetap memakai gambar per game.
 */
export async function syncOgImages(state: SiteState, token: string): Promise<number> {
  let made = 0
  for (const item of state.items) {
    try {
      const sig = ogSignature(item)
      const { sig: current } = await api.ogMeta(item.id)
      if (current === sig) continue
      const blob = await toJpeg(await drawOg(ogContentFor(item)))
      await api.uploadOg(item.id, sig, blob, token)
      made++
    } catch (err) {
      console.warn('[og] gambar preview gagal dibuat untuk', item.id, err)
    }
  }
  return made
}
