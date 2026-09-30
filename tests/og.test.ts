import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ogHandler from '../netlify/functions/og.mts'
import { issueToken } from '../netlify/lib/auth'
import { cleanupOg } from '../netlify/lib/og'
import { memoryAudioStore, setOgStoreForTests } from '../netlify/lib/store'
import { createJarkoman } from '../src/shared/defaults'

const req = (path: string, init: RequestInit = {}) => new Request(`http://localhost${path}`, init)
const auth = () => ({ authorization: `Bearer ${issueToken().token}` })
const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])

beforeEach(() => {
  process.env.ADMIN_PASSWORD = 'rahasia-mabar'
  setOgStoreForTests(memoryAudioStore())
})

afterEach(() => setOgStoreForTests(null))

describe('gambar preview per jarkoman (/api/og)', () => {
  it('hanya admin yang bisa mengunggah, siapa saja bisa membaca', async () => {
    const put = (headers: Record<string, string>) =>
      ogHandler(req('/api/og?id=abcd1234&sig=v1abc', { method: 'PUT', headers: { 'content-type': 'image/jpeg', ...headers }, body: jpeg() }))
    expect((await put({})).status).toBe(401)
    expect((await put(auth())).status).toBe(200)

    const meta = (await (await ogHandler(req('/api/og?id=abcd1234&meta=1'))).json()) as { sig: string }
    expect(meta.sig).toBe('v1abc')
    const img = await ogHandler(req('/api/og?id=abcd1234&v=v1abc'))
    expect(img.status).toBe(200)
    expect(img.headers.get('content-type')).toBe('image/jpeg')
    expect(img.headers.get('cache-control')).toContain('immutable')
    expect((await ogHandler(req('/api/og?id=zzzz9999'))).status).toBe(404)
  })

  it('menolak format selain gambar dan id yang tidak valid', async () => {
    const bad = await ogHandler(req('/api/og?id=abcd1234&sig=v1abc', { method: 'PUT', headers: { 'content-type': 'text/html', ...auth() }, body: '<b>' }))
    expect(bad.status).toBe(415)
    expect((await ogHandler(req('/api/og?id=../x'))).status).toBe(400)
  })

  it('gambar jarkoman yang sudah dihapus ikut dibersihkan', async () => {
    const keep = createJarkoman('valorant')
    for (const id of [keep.id, 'hapus123']) {
      await ogHandler(req(`/api/og?id=${id}&sig=v1abc`, { method: 'PUT', headers: { 'content-type': 'image/jpeg', ...auth() }, body: jpeg() }))
    }
    const removed = await cleanupOg({ version: 1, featuredId: keep.id, items: [keep], updatedAt: 1, joinSeq: 0, gone: [] })
    expect(removed).toBe(1)
    expect((await ogHandler(req(`/api/og?id=${keep.id}`))).status).toBe(200)
  })
})
