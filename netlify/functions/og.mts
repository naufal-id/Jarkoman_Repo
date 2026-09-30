import type { Config } from '@netlify/functions'
import { ID_PATTERN } from '../../src/shared/sanitize'
import { bearer, isConfigured, verifyToken } from '../lib/auth'
import { error, json } from '../lib/http'
import { MAX_OG_BYTES, OG_SIG, OG_TYPES } from '../lib/og'
import { ogStore } from '../lib/store'

/**
 * Gambar preview link per jarkoman (1200 x 630). Dibuat di browser dashboard admin saat menyimpan, lalu diunggah ke
 * sini. GET publik untuk bot WhatsApp dan kawan-kawan; `?meta=1` hanya mengembalikan tanda versinya.
 */
export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const id = url.searchParams.get('id') ?? ''
  if (!ID_PATTERN.test(id)) return error(400, 'Jarkoman tidak dikenali.')
  const store = ogStore()

  if (req.method === 'GET') {
    const file = await store.get(id)
    if (url.searchParams.get('meta') === '1') return json({ sig: file?.sig ?? null })
    if (!file) return error(404, 'Gambar belum dibuat.')
    return new Response(file.data, {
      status: 200,
      headers: {
        'content-type': file.contentType,
        'content-length': String(file.data.byteLength),
        // URL dari edge function memuat ?v=<sig>, jadi isi untuk URL yang sama tidak berubah.
        'cache-control': url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
      },
    })
  }

  if (req.method === 'PUT') {
    if (!isConfigured()) return error(503, 'ADMIN_PASSWORD belum diset di Netlify.', { code: 'not-configured' })
    if (!verifyToken(bearer(req))) return error(401, 'Sesi admin habis. Silakan login lagi.', { code: 'unauthorized' })
    const sig = url.searchParams.get('sig') ?? ''
    if (!OG_SIG.test(sig)) return error(400, 'Tanda versi tidak valid.')
    const type = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    if (!OG_TYPES.includes(type)) return error(415, 'Format gambar tidak didukung.')
    if (Number(req.headers.get('content-length') ?? 0) > MAX_OG_BYTES) return error(413, 'Gambar terlalu besar.')
    const data = await req.arrayBuffer()
    if (data.byteLength === 0) return error(400, 'Gambar kosong.')
    if (data.byteLength > MAX_OG_BYTES) return error(413, 'Gambar terlalu besar.')
    await store.set(id, data, type, Date.now(), sig)
    return json({ ok: true })
  }

  return error(405, 'Metode tidak didukung.')
}

export const config: Config = {
  path: '/api/og',
  method: ['GET', 'PUT'],
}
