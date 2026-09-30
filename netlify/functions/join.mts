import type { Config } from '@netlify/functions'
import { addWebPlayer, JoinError, publicItem, removeWebPlayer, slotOf, updateWebPlayer, type JoinErrorCode } from '../../src/shared/joins'
import { cleanState, ID_PATTERN } from '../../src/shared/sanitize'
import type { SiteState } from '../../src/shared/types'
import { joinKey, verifyJoinKey } from '../lib/auth'
import { joinSecrets } from '../lib/join-secret'
import { checkLimit, clientIp, JOIN_RATE } from '../lib/ratelimit'
import { error, json, readJson } from '../lib/http'
import { stateStore, updateJSON, WriteConflictError } from '../lib/store'

const KEY = 'state'

const STATUS: Record<JoinErrorCode, number> = {
  'not-found': 404,
  manual: 403,
  closed: 409,
  'list-full': 409,
  'name-taken': 409,
  invalid: 400,
}

type Body = Record<string, unknown>

const text = (v: unknown) => (typeof v === 'string' ? v : '')

function load(current: SiteState | null): SiteState {
  const state = current ? cleanState(current)?.state : null
  if (!state) throw new JoinError('not-found', 'Jarkoman ini belum dipublikasikan host.')
  return state
}

/**
 * Pendaftaran langsung dari halaman publik (tanpa login).
 * POST: tambah pemain ke skuad. DELETE: batalkan pendaftaran sendiri memakai kunci dari POST.
 */
export default async function handler(req: Request, context?: { ip?: string }): Promise<Response> {
  if (req.method !== 'POST' && req.method !== 'DELETE' && req.method !== 'PATCH') return error(405, 'Metode tidak didukung.')

  let body: Body
  try {
    body = (await readJson(req, 4_000)) as Body
  } catch {
    return error(400, 'Data pendaftaran tidak valid.')
  }
  if (!body || typeof body !== 'object') return error(400, 'Data pendaftaran tidak valid.')
  const id = text(body.id)
  if (!ID_PATTERN.test(id)) return error(400, 'Jarkoman tidak dikenali.')
  // Kolom jebakan untuk bot: manusia tidak pernah melihat atau mengisinya.
  if (text(body.website)) return error(400, 'Data pendaftaran tidak valid.')

  const store = stateStore()
  try {
    const secrets = await joinSecrets(store)
    if (req.method === 'POST') {
      const rate = await checkLimit(store, id, clientIp(req, context), JOIN_RATE)
      if (rate.limited) {
        return error(429, 'Terlalu banyak pendaftaran dari jaringan ini. Coba lagi beberapa menit lagi atau kabari host.', { code: 'rate-limited' })
      }
      const out = await updateJSON<SiteState, ReturnType<typeof addWebPlayer>>(store, KEY, (current) => {
        const result = addWebPlayer(load(current), { id, name: text(body.name), role: text(body.role), pick: text(body.pick), note: text(body.note) })
        return { value: result.state, result }
      })
      await rate.commit()
      return json({ item: publicItem(out.item), player: out.player, key: joinKey(id, out.player.id, secrets.current), slot: slotOf(out.item, out.player.id) })
    }

    const playerId = text(body.player)
    if (!ID_PATTERN.test(playerId) || !verifyJoinKey(id, playerId, body.key, secrets.accepted)) {
      return error(403, 'Pendaftaran ini tidak bisa diubah dari perangkat ini. Hubungi host.', { code: 'forbidden' })
    }
    if (req.method === 'PATCH') {
      // Ubah role, pick, atau catatan sendiri. Field yang tidak dikirim tidak berubah.
      const patch = {
        role: typeof body.role === 'string' ? body.role : undefined,
        pick: typeof body.pick === 'string' ? body.pick : undefined,
        note: typeof body.note === 'string' ? body.note : undefined,
      }
      const out = await updateJSON<SiteState, ReturnType<typeof updateWebPlayer>>(store, KEY, (current) => {
        const result = updateWebPlayer(load(current), id, playerId, patch)
        return { value: result.state, result }
      })
      return json({ item: publicItem(out.item), player: { ...out.player, note: '' } })
    }
    const out = await updateJSON<SiteState, ReturnType<typeof removeWebPlayer>>(store, KEY, (current) => {
      const result = removeWebPlayer(load(current), id, playerId)
      return { value: result.state, result }
    })
    return json({ item: publicItem(out.item) })
  } catch (err) {
    if (err instanceof JoinError) return error(STATUS[err.code], err.message, { code: err.code })
    if (err instanceof WriteConflictError) return error(503, 'Lagi ramai yang daftar. Coba tekan lagi.', { code: 'busy' })
    console.error('[join] gagal', err)
    return error(500, 'Pendaftaran gagal disimpan. Coba lagi sebentar.')
  }
}

export const config: Config = {
  path: '/api/join',
  method: ['POST', 'PATCH', 'DELETE'],
}
