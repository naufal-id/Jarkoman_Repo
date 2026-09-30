import { createHash } from 'node:crypto'
import type { KV } from './store'

export interface RateRule {
  /** Jumlah maksimum aksi dalam satu jendela */
  max: number
  windowMs: number
}

/** Pendaftaran lewat website per jarkoman per alamat IP: cukup untuk satu grup yang berbagi Wi-Fi, menahan spam. */
export const JOIN_RATE: RateRule = { max: 6, windowMs: 10 * 60_000 }

/** IP klien dari Netlify (context.ip) atau header proxy. Kosong kalau tidak diketahui (misalnya test lokal). */
export function clientIp(req: Request, context?: { ip?: string }): string {
  const fromCtx = context?.ip?.trim()
  if (fromCtx) return fromCtx
  const nf = req.headers.get('x-nf-client-connection-ip')?.trim()
  if (nf) return nf
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
}

type Log = Record<string, number[]>

/**
 * Catat satu aksi dan kembalikan true kalau sudah melewati batas. Satu key per jarkoman berisi hash IP (bukan IP
 * mentah) dan waktu aksi; entri lama dibuang setiap kali ditulis supaya ukurannya tetap kecil. Sengaja tidak memakai
 * tulis bersyarat: ini rem spam, bukan hitungan yang harus tepat.
 */
export async function hitLimit(kv: KV, scope: string, ip: string, rule: RateRule, now = Date.now()): Promise<boolean> {
  if (!ip) return false
  const key = `rl-${scope}`
  const who = createHash('sha256').update(`jarkoman:${ip}`).digest('base64url').slice(0, 16)
  const log = (await kv.getJSON<Log>(key).catch(() => null)) ?? {}
  const fresh: Log = {}
  for (const [k, times] of Object.entries(log)) {
    const kept = Array.isArray(times) ? times.filter((t) => typeof t === 'number' && now - t < rule.windowMs) : []
    if (kept.length) fresh[k] = kept
  }
  const mine = fresh[who] ?? []
  if (mine.length >= rule.max) return true
  fresh[who] = [...mine, now]
  await kv.setJSON(key, fresh).catch((err) => console.warn('[ratelimit] gagal menulis', err))
  return false
}
