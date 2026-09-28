import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import audioHandler from '../netlify/functions/audio.mts'
import stateHandler from '../netlify/functions/state.mts'
import { cleanupAudio, parseRange } from '../netlify/lib/audio'
import { issueToken } from '../netlify/lib/auth'
import { memoryAudioStore, memoryStore, setAudioStoreForTests, setStoreForTests, type AudioStore } from '../netlify/lib/store'
import { createJarkoman } from '../src/shared/defaults'
import { cleanMusic } from '../src/shared/sanitize'

let audio: AudioStore

beforeEach(() => {
  process.env.ADMIN_PASSWORD = 'rahasia-mabar'
  audio = memoryAudioStore()
  setAudioStoreForTests(audio)
  setStoreForTests(memoryStore())
})

afterEach(() => {
  setAudioStoreForTests(null)
  setStoreForTests(null)
})

const auth = () => ({ authorization: `Bearer ${issueToken().token}` })
const bytes = (n: number): Uint8Array<ArrayBuffer> => new Uint8Array(Array.from({ length: n }, (_, i) => i % 256))

async function upload(body: Uint8Array<ArrayBuffer>, type = 'audio/mpeg', headers: Record<string, string> = auth()) {
  return audioHandler(new Request('http://x/api/audio', { method: 'POST', headers: { 'content-type': type, ...headers }, body }))
}

describe('upload lagu', () => {
  it('butuh login', async () => {
    const res = await upload(bytes(10), 'audio/mpeg', {})
    expect(res.status).toBe(401)
  })

  it('menolak tipe bukan audio', async () => {
    const res = await upload(bytes(10), 'text/html')
    expect(res.status).toBe(415)
  })

  it('menolak file kosong dan terlalu besar', async () => {
    expect((await upload(new Uint8Array(0))).status).toBe(400)
    expect((await upload(bytes(10), 'audio/mpeg', { ...auth(), 'content-length': String(5 * 1024 * 1024) })).status).toBe(413)
  })

  it('simpan, putar penuh, putar sebagian (Range), lalu hapus', async () => {
    const res = await upload(bytes(1000), 'audio/mp3')
    expect(res.status).toBe(200)
    const { url } = (await res.json()) as { url: string }
    expect(url).toMatch(/^\/api\/audio\?id=[a-z0-9]{16}$/)

    const full = await audioHandler(new Request(`http://x${url}`))
    expect(full.status).toBe(200)
    expect(full.headers.get('content-type')).toBe('audio/mpeg')
    expect(full.headers.get('accept-ranges')).toBe('bytes')
    expect((await full.arrayBuffer()).byteLength).toBe(1000)

    const part = await audioHandler(new Request(`http://x${url}`, { headers: { range: 'bytes=100-199' } }))
    expect(part.status).toBe(206)
    expect(part.headers.get('content-range')).toBe('bytes 100-199/1000')
    const chunk = new Uint8Array(await part.arrayBuffer())
    expect(chunk.length).toBe(100)
    expect(chunk[0]).toBe(100)

    const bad = await audioHandler(new Request(`http://x${url}`, { headers: { range: 'bytes=5000-' } }))
    expect(bad.status).toBe(416)

    const id = url.split('=')[1]
    const del = await audioHandler(new Request(`http://x/api/audio?id=${id}`, { method: 'DELETE', headers: auth() }))
    expect(del.status).toBe(200)
    expect((await audioHandler(new Request(`http://x${url}`))).status).toBe(404)
  })
})

describe('range header', () => {
  it('parse variasi rentang', () => {
    expect(parseRange(null, 100)).toBeNull()
    expect(parseRange('bytes=0-', 100)).toEqual({ start: 0, end: 99 })
    expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 })
    expect(parseRange('bytes=50-500', 100)).toEqual({ start: 50, end: 99 })
    expect(parseRange('items=0-1', 100)).toBe('invalid')
  })
})

describe('pembersihan lagu', () => {
  it('menghapus lagu yatim yang sudah lama, menyimpan yang dipakai dan yang baru', async () => {
    const day = 24 * 3600_000
    const now = Date.now()
    await audio.set('dipakaiaaaaaaaaa', new ArrayBuffer(4), 'audio/mpeg', now - 3 * day)
    await audio.set('yatimlamaaaaaaaa', new ArrayBuffer(4), 'audio/mpeg', now - 3 * day)
    await audio.set('yatimbaruaaaaaaa', new ArrayBuffer(4), 'audio/mpeg', now - 60_000)
    const item = createJarkoman('repo')
    item.music = '/api/audio?id=dipakaiaaaaaaaaa'
    const removed = await cleanupAudio({ version: 1, featuredId: item.id, items: [item], updatedAt: 1 }, now)
    expect(removed).toBe(1)
    const keys = (await audio.list()).map((f) => f.key).sort()
    expect(keys).toEqual(['dipakaiaaaaaaaaa', 'yatimbaruaaaaaaa'])
  })

  it('simpan state memicu pembersihan', async () => {
    await audio.set('yatimlamaaaaaaaa', new ArrayBuffer(4), 'audio/mpeg', 0)
    const item = createJarkoman('cs2')
    const res = await stateHandler(
      new Request('http://x/api/state', {
        method: 'PUT',
        headers: auth(),
        body: JSON.stringify({ state: { version: 1, featuredId: item.id, items: [item], updatedAt: 0 }, baseUpdatedAt: 0 }),
      }),
    )
    expect(res.status).toBe(200)
    expect(await audio.list()).toEqual([])
  })
})

describe('sanitasi musik', () => {
  it('hanya menerima nilai yang dikenal', () => {
    expect(cleanMusic('')).toBe('')
    expect(cleanMusic('none')).toBe('none')
    expect(cleanMusic('/api/audio?id=abcdefgh12345678')).toBe('/api/audio?id=abcdefgh12345678')
    expect(cleanMusic('/api/audio?id=../../etc')).toBe('')
    expect(cleanMusic('https://cdn.test/lagu.mp3')).toBe('https://cdn.test/lagu.mp3')
    expect(cleanMusic('javascript:alert(1)')).toBe('')
  })
})
