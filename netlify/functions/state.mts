import type { Config } from '@netlify/functions'
import { cleanState } from '../../src/shared/sanitize'
import type { SiteState } from '../../src/shared/types'
import { cleanupAudio } from '../lib/audio'
import { bearer, isConfigured, verifyToken } from '../lib/auth'
import { error, json, readJson } from '../lib/http'
import { stateStore } from '../lib/store'

const KEY = 'state'

export default async function handler(req: Request): Promise<Response> {
  const store = stateStore()

  if (req.method === 'GET') {
    try {
      const state = await store.getJSON<SiteState>(KEY)
      return json({ state })
    } catch (err) {
      console.error('[state] read failed', err)
      return error(500, 'Gagal membaca data jarkoman.')
    }
  }

  if (req.method === 'PUT') {
    if (!isConfigured()) return error(503, 'ADMIN_PASSWORD belum diset di Netlify.', { code: 'not-configured' })
    if (!verifyToken(bearer(req))) return error(401, 'Sesi admin habis. Silakan login lagi.', { code: 'unauthorized' })

    let body: unknown
    try {
      body = await readJson(req)
    } catch {
      return error(400, 'Body harus JSON yang valid dan tidak lebih dari 256 KB.')
    }
    const input = body as { state?: unknown; baseUpdatedAt?: unknown; force?: unknown }
    const cleaned = cleanState(input?.state)
    if (!cleaned) return error(400, 'Format data tidak dikenali.')
    if (cleaned.state.items.length === 0) return error(400, 'Minimal harus ada satu jarkoman.')

    try {
      const current = await store.getJSON<SiteState>(KEY)
      const base = Number(input.baseUpdatedAt ?? 0)
      if (current && input.force !== true && current.updatedAt !== base) {
        return error(409, 'Ada versi lebih baru yang disimpan dari perangkat lain.', { code: 'conflict', state: current })
      }
      const next: SiteState = { ...cleaned.state, updatedAt: Math.max(Date.now(), (current?.updatedAt ?? 0) + 1) }
      await store.setJSON(KEY, next)
      // Bersihkan lagu upload yang sudah tidak dipakai. Gagal di sini tidak membatalkan simpan.
      await cleanupAudio(next).catch((err) => console.warn('[state] cleanup audio gagal', err))
      return json({ state: next, dropped: cleaned.dropped })
    } catch (err) {
      console.error('[state] write failed', err)
      return error(500, 'Gagal menyimpan. Coba lagi sebentar.')
    }
  }

  return error(405, 'Metode tidak didukung.')
}

export const config: Config = {
  path: '/api/state',
  method: ['GET', 'PUT'],
}
