import { createHash } from 'node:crypto'
import type { KV } from './store'

export interface RateRule {
  /** Jumlah maksimum aksi dalam satu jendela */
  max: number
  windowMs: number
}

/** Pendaftaran lewat website per jarkoman per alamat IP: cukup untuk satu grup yang berbagi Wi-Fi, menahan spam. */
export const JOIN_RATE: RateRule = { max: 6, windowMs: 10 * 60_000 }

const KEY = 'ratelimit'

/** IP klien dari Netlify (context.ip) atau header proxy. Kosong kalau tidak diketahui (misalnya test lokal). */
export function clientIp(req: Request, context?: { ip?: string }): string {
  const fromCtx = context?.ip?.trim()
  if (fromCtx) return fromCtx
  const nf = req.headers.get('x-nf-client-connection-ip')?.trim()
  if (nf) return nf
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
}

/** scope (id jarkoman) -> hash IP -> waktu aksi */
type Log = Record<string, Record<string, number[]>>

const hashIp = (ip: string) => createHash('sha256').update(`jarkoman:${ip}`).digest('base64url').slice(0, 16)

/** Buang catatan yang sudah lewat jendela (termasuk jarkoman yang sudah dihapus), supaya key tetap kecil. */
function prune(log: Log, now: number, windowMs: number): Log {
  const out: Log = {}
  for (const [scope, byIp] of Object.entries(log && typeof log === 'object' ? log : {})) {
    const kept: Record<string, number[]> = {}
    for (const [who, times] of Object.entries(byIp && typeof byIp === 'object' ? byIp : {})) {
      const fresh = Array.isArray(times) ? times.filter((t) => typeof t === 'number' && now - t < windowMs) : []
      if (fresh.length) kept[who] = fresh
    }
    if (Object.keys(kept).length) out[scope] = kept
  }
  return out
}

export interface RateCheck {
  limited: boolean
  /** Catat aksi yang berhasil. Aksi yang ditolak (nama kembar, sesi selesai) tidak dihitung. */
  commit(): Promise<void>
}

/**
 * Cek batas tanpa menulis apa pun; tulisan hanya terjadi lewat commit() setelah aksi berhasil, jadi id acak atau
 * percobaan yang gagal tidak menambah data. Sengaja tidak memakai tulis bersyarat: ini rem spam, bukan hitungan
 * yang harus tepat.
 */
export async function checkLimit(kv: KV, scope: string, ip: string, rule: RateRule, now = Date.now()): Promise<RateCheck> {
  if (!ip) return { limited: false, commit: async () => {} }
  const who = hashIp(ip)
  const log = prune((await kv.getJSON<Log>(KEY).catch(() => null)) ?? {}, now, rule.windowMs)
  const mine = log[scope]?.[who] ?? []
  return {
    limited: mine.length >= rule.max,
    async commit() {
      const latest = prune((await kv.getJSON<Log>(KEY).catch(() => null)) ?? {}, Date.now(), rule.windowMs)
      const scoped = latest[scope] ?? {}
      scoped[who] = [...(scoped[who] ?? []), Date.now()]
      latest[scope] = scoped
      await kv.setJSON(KEY, latest).catch((err) => console.warn('[ratelimit] gagal menulis', err))
    },
  }
}
