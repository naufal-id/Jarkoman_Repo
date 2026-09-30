import { randomBytes } from 'node:crypto'
import { legacyJoinSecret } from './auth'
import { updateJSON, type KV } from './store'

const KEY = 'join-secret'

const cache = new WeakMap<KV, Promise<string>>()

/**
 * Rahasia untuk kunci pendaftar. Pakai JARKOMAN_SECRET kalau diisi; kalau tidak, rahasia acak dibuat sekali
 * dan disimpan di store (tulis bersyarat, jadi dua fungsi yang jalan bersamaan tetap memakai rahasia yang sama).
 */
async function stored(kv: KV): Promise<string> {
  return updateJSON<{ secret?: string }, string>(kv, KEY, (current) => {
    if (typeof current?.secret === 'string' && current.secret.length >= 32) return { result: current.secret }
    const secret = randomBytes(32).toString('base64url')
    return { value: { secret }, result: secret }
  })
}

export interface JoinSecrets {
  /** Dipakai untuk kunci baru. */
  current: string
  /** Semua rahasia yang masih diterima saat memeriksa kunci. */
  accepted: string[]
}

export async function joinSecrets(kv: KV): Promise<JoinSecrets> {
  const env = (process.env.JARKOMAN_SECRET ?? '').trim()
  if (env) return { current: env, accepted: [env] }
  let pending = cache.get(kv)
  if (!pending) {
    pending = stored(kv)
    cache.set(kv, pending)
    pending.catch(() => cache.delete(kv))
  }
  const current = await pending
  // Kunci yang dibagikan sebelum rahasia tersimpan ini ada ditandatangani dengan rahasia turunan password.
  return { current, accepted: [current, legacyJoinSecret()] }
}
