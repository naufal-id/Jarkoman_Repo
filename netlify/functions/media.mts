import type { Config } from '@netlify/functions'
import { GAME_IDS } from '../../src/shared/types'
import type { GameId, MediaPayload } from '../../src/shared/types'
import { error, json } from '../lib/http'
import { loadMedia } from '../lib/media'

const TTL_MS = 6 * 60 * 60 * 1000
const cache = new Map<GameId, { at: number; data: MediaPayload }>()

export default async function handler(req: Request): Promise<Response> {
  const game = new URL(req.url).searchParams.get('game') as GameId | null
  if (!game || !GAME_IDS.includes(game)) return error(400, 'Parameter game tidak valid.')

  const hit = cache.get(game)
  if (hit && Date.now() - hit.at < TTL_MS) return cached(hit.data)

  try {
    const data = await loadMedia(game)
    cache.set(game, { at: Date.now(), data })
    return cached(data)
  } catch (err) {
    console.warn(`[media] ${game} gagal`, err)
    if (hit) return cached(hit.data)
    return error(502, 'Sumber gambar resmi sedang tidak bisa diakses.')
  }
}

function cached(data: MediaPayload): Response {
  return json(data, {
    headers: {
      'cache-control': 'public, max-age=900',
      'netlify-cdn-cache-control': 'public, durable, s-maxage=43200, stale-while-revalidate=86400',
    },
  })
}

export const config: Config = {
  path: '/api/media',
  method: ['GET'],
}
