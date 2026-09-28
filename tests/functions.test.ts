import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import loginHandler from '../netlify/functions/login.mts'
import stateHandler from '../netlify/functions/state.mts'
import { issueToken, verifyToken } from '../netlify/lib/auth'
import { hexFromRgba, loadMedia, upscaleAppStore } from '../netlify/lib/media'
import { memoryAudioStore, memoryStore, setAudioStoreForTests, setStoreForTests } from '../netlify/lib/store'
import { createJarkoman } from '../src/shared/defaults'

const req = (path: string, init: RequestInit = {}) => new Request(`http://localhost${path}`, init)

beforeEach(() => {
  process.env.ADMIN_PASSWORD = 'rahasia-mabar'
  delete process.env.JARKOMAN_SECRET
  setStoreForTests(memoryStore())
  setAudioStoreForTests(memoryAudioStore())
})

afterEach(() => {
  setStoreForTests(null)
  setAudioStoreForTests(null)
})

async function login(password = 'rahasia-mabar') {
  const res = await loginHandler(req('/api/login', { method: 'POST', body: JSON.stringify({ password }) }))
  return { res, body: (await res.json()) as { token?: string; error?: string } }
}

describe('login', () => {
  it('menerbitkan token untuk password benar', async () => {
    const { res, body } = await login()
    expect(res.status).toBe(200)
    expect(verifyToken(body.token)).toBe(true)
  })

  it('menolak password salah', async () => {
    const { res } = await login('salah')
    expect(res.status).toBe(401)
  })

  it('memberi tahu jika ADMIN_PASSWORD belum diset', async () => {
    process.env.ADMIN_PASSWORD = ''
    const { res, body } = await login()
    expect(res.status).toBe(503)
    expect(body.error).toContain('ADMIN_PASSWORD')
    const status = await (await loginHandler(req('/api/login'))).json()
    expect(status).toEqual({ configured: false, valid: false })
  })

  it('token kedaluwarsa atau dipalsukan ditolak', () => {
    const { token } = issueToken(Date.now() - 8 * 24 * 3600_000)
    expect(verifyToken(token)).toBe(false)
    const fresh = issueToken().token
    expect(verifyToken(fresh.replace(/.$/, fresh.endsWith('A') ? 'B' : 'A'))).toBe(false)
    process.env.ADMIN_PASSWORD = 'password-baru'
    expect(verifyToken(fresh)).toBe(false)
  })
})

describe('state', () => {
  it('GET mengembalikan null saat belum ada data', async () => {
    const res = await stateHandler(req('/api/state'))
    expect(await res.json()).toEqual({ state: null })
  })

  it('PUT butuh token', async () => {
    const res = await stateHandler(req('/api/state', { method: 'PUT', body: '{}' }))
    expect(res.status).toBe(401)
  })

  it('simpan, baca ulang, dan deteksi konflik', async () => {
    const { body } = await login()
    const auth = { authorization: `Bearer ${body.token}` }
    const item = createJarkoman('cs2')
    const state = { version: 1, featuredId: item.id, items: [item], updatedAt: 0 }

    const first = await stateHandler(req('/api/state', { method: 'PUT', headers: auth, body: JSON.stringify({ state, baseUpdatedAt: 0 }) }))
    expect(first.status).toBe(200)
    const saved = (await first.json()) as { state: { updatedAt: number; items: unknown[] } }
    expect(saved.state.items).toHaveLength(1)

    const read = (await (await stateHandler(req('/api/state'))).json()) as { state: { updatedAt: number } }
    expect(read.state.updatedAt).toBe(saved.state.updatedAt)

    const stale = await stateHandler(req('/api/state', { method: 'PUT', headers: auth, body: JSON.stringify({ state, baseUpdatedAt: 1 }) }))
    expect(stale.status).toBe(409)

    const forced = await stateHandler(req('/api/state', { method: 'PUT', headers: auth, body: JSON.stringify({ state, baseUpdatedAt: 1, force: true }) }))
    expect(forced.status).toBe(200)
  })

  it('menolak state tanpa jarkoman', async () => {
    const { body } = await login()
    const res = await stateHandler(
      req('/api/state', {
        method: 'PUT',
        headers: { authorization: `Bearer ${body.token}` },
        body: JSON.stringify({ state: { items: [] } }),
      }),
    )
    expect(res.status).toBe(400)
  })
})

describe('media', () => {
  const fakeFetch = (routes: Record<string, unknown>) =>
    (async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input)
      const key = Object.keys(routes).find((k) => url.startsWith(k))
      if (!key) return new Response('not found', { status: 404 })
      return Response.json(routes[key])
    }) as typeof fetch

  it('normalisasi valorant-api', async () => {
    const data = await loadMedia(
      'valorant',
      fakeFetch({
        'https://valorant-api.com/v1/maps': {
          data: [
            { displayName: 'Ascent', splash: 'https://media/ascent.png', listViewIconTall: 'https://media/ascent-tall.png' },
            { displayName: 'The Range', splash: 'https://media/range.png' },
          ],
        },
        'https://valorant-api.com/v1/agents': {
          data: [
            {
              displayName: 'Jett',
              fullPortrait: 'https://media/jett.png',
              displayIcon: 'https://media/jett-icon.png',
              backgroundGradientColors: ['9adeffff', '3a7fb5ff'],
              role: { displayName: 'Duelist' },
            },
          ],
        },
      }),
    )
    expect(data.maps).toEqual({ ascent: 'https://media/ascent.png' })
    expect(data.gallery).toHaveLength(1)
    expect(data.agents?.jett).toMatchObject({ portrait: 'https://media/jett.png', colors: ['#9adeff', '#3a7fb5'], role: 'Duelist' })
  })

  it('normalisasi Steam', async () => {
    const data = await loadMedia(
      'repo',
      fakeFetch({
        'https://store.steampowered.com/api/appdetails': {
          '3241660': {
            success: true,
            data: {
              header_image: 'https://cdn/header.jpg',
              background_raw: 'https://cdn/bg.jpg',
              screenshots: [{ path_full: 'https://cdn/s1.jpg', path_thumbnail: 'https://cdn/s1t.jpg' }],
            },
          },
        },
      }),
    )
    expect(data.hero).toBe('https://cdn/s1.jpg')
    expect(data.gallery.map((g) => g.kind)).toEqual(['shot', 'art', 'art'])
  })

  it('normalisasi App Store', async () => {
    const data = await loadMedia(
      'mlbb',
      fakeFetch({
        'https://itunes.apple.com/lookup': { results: [{ screenshotUrls: ['https://is1.mzstatic.com/a/392x696bb.jpg'] }] },
      }),
    )
    expect(data.gallery[0].url).toBe('https://is1.mzstatic.com/a/1600x0w.jpg')
    expect(upscaleAppStore('https://x/abc/100x100bb.png')).toBe('https://x/abc/1600x0w.jpg')
  })

  it('helper warna', () => {
    expect(hexFromRgba('ff4655ff')).toBe('#ff4655')
    expect(hexFromRgba('zz')).toBeNull()
  })
})
