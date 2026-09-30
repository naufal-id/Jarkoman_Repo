import type { Config } from '@netlify/functions'
import { applyWebChanges, keepNotes, publicState } from '../../src/shared/joins'
import { cleanState } from '../../src/shared/sanitize'
import type { SiteState } from '../../src/shared/types'
import { cleanupAudio } from '../lib/audio'
import { bearer, isConfigured, verifyToken } from '../lib/auth'
import { error, json, readJson } from '../lib/http'
import { stateStore, updateJSON, WriteConflictError } from '../lib/store'

const KEY = 'state'

export default async function handler(req: Request): Promise<Response> {
  const store = stateStore()

  if (req.method === 'GET') {
    try {
      const state = await store.getJSON<SiteState>(KEY)
      // Catatan pemain hanya untuk admin yang login.
      const admin = isConfigured() && verifyToken(bearer(req))
      return json({ state: state && !admin ? publicState(state) : state })
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

    const incoming = cleaned.state
    const base = Number(input.baseUpdatedAt ?? 0)
    try {
      const outcome = await updateJSON<SiteState, { conflict: SiteState } | { saved: SiteState }>(store, KEY, (raw) => {
        const current = raw ? (cleanState(raw)?.state ?? null) : null
        if (current && input.force !== true && current.updatedAt !== base) return { result: { conflict: current } }
        // Pemain yang mendaftar atau batal lewat web setelah admin membuka dashboard tidak boleh hilang
        // hanya karena draft admin belum memuatnya. Pendaftaran web tidak mengubah updatedAt, jadi tidak bikin konflik.
        const merged = current ? keepNotes(applyWebChanges(incoming, current, incoming.joinSeq), current) : incoming
        const saved: SiteState = { ...merged, updatedAt: Math.max(Date.now(), (current?.updatedAt ?? 0) + 1) }
        return { value: saved, result: { saved } }
      })
      if ('conflict' in outcome) {
        return error(409, 'Ada versi lebih baru yang disimpan dari perangkat lain.', { code: 'conflict', state: outcome.conflict })
      }
      // Bersihkan lagu upload yang sudah tidak dipakai. Gagal di sini tidak membatalkan simpan.
      await cleanupAudio(outcome.saved).catch((err) => console.warn('[state] cleanup audio gagal', err))
      return json({ state: outcome.saved, dropped: cleaned.dropped })
    } catch (err) {
      if (err instanceof WriteConflictError) return error(503, 'Data sedang ramai diubah. Coba simpan lagi.')
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
