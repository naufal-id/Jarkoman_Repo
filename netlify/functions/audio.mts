import type { Config } from '@netlify/functions'
import { uid } from '../../src/shared/ids'
import { AUDIO_TYPES, MAX_AUDIO_BYTES, parseRange } from '../lib/audio'
import { bearer, isConfigured, verifyToken } from '../lib/auth'
import { error, json } from '../lib/http'
import { audioStore } from '../lib/store'

const ID = /^[a-z0-9]{8,40}$/

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const store = audioStore()

  if (req.method === 'GET') {
    const id = url.searchParams.get('id') ?? ''
    if (!ID.test(id)) return error(400, 'ID lagu tidak valid.')
    const file = await store.get(id)
    if (!file) return error(404, 'Lagu tidak ditemukan.')
    const size = file.data.byteLength
    const headers: Record<string, string> = {
      'content-type': file.contentType,
      'accept-ranges': 'bytes',
      'content-disposition': 'inline',
      // ID unik per upload, jadi isi file tidak pernah berubah.
      'cache-control': 'public, max-age=31536000, immutable',
    }
    // Safari/iOS butuh dukungan Range untuk memutar audio.
    const range = parseRange(req.headers.get('range'), size)
    if (range === 'invalid') return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } })
    if (range) {
      return new Response(file.data.slice(range.start, range.end + 1), {
        status: 206,
        headers: { ...headers, 'content-range': `bytes ${range.start}-${range.end}/${size}`, 'content-length': String(range.end - range.start + 1) },
      })
    }
    return new Response(file.data, { status: 200, headers: { ...headers, 'content-length': String(size) } })
  }

  if (req.method === 'POST' || req.method === 'DELETE') {
    if (!isConfigured()) return error(503, 'ADMIN_PASSWORD belum diset di Netlify.', { code: 'not-configured' })
    if (!verifyToken(bearer(req))) return error(401, 'Sesi admin habis. Silakan login lagi.', { code: 'unauthorized' })
  }

  if (req.method === 'POST') {
    const type = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    if (!AUDIO_TYPES.includes(type)) return error(415, 'Format tidak didukung. Pakai MP3, M4A, OGG, WAV, atau FLAC.')
    const declared = Number(req.headers.get('content-length') ?? 0)
    if (declared > MAX_AUDIO_BYTES) return error(413, 'File terlalu besar. Maksimal 4,5 MB.')
    const data = await req.arrayBuffer()
    if (data.byteLength === 0) return error(400, 'File kosong.')
    if (data.byteLength > MAX_AUDIO_BYTES) return error(413, 'File terlalu besar. Maksimal 4,5 MB.')
    const id = uid(16)
    await store.set(id, data, type === 'audio/mp3' ? 'audio/mpeg' : type, Date.now())
    return json({ url: `/api/audio?id=${id}`, size: data.byteLength })
  }

  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id') ?? ''
    if (!ID.test(id)) return error(400, 'ID lagu tidak valid.')
    await store.delete(id)
    return json({ ok: true })
  }

  return error(405, 'Metode tidak didukung.')
}

export const config: Config = {
  path: '/api/audio',
  method: ['GET', 'POST', 'DELETE'],
}
