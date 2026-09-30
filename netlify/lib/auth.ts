import { createHmac, timingSafeEqual } from 'node:crypto'

export const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function adminPassword(): string {
  return (process.env.ADMIN_PASSWORD ?? '').trim()
}

export function isConfigured(): boolean {
  return adminPassword().length > 0
}

function secret(): string {
  return (process.env.JARKOMAN_SECRET ?? '').trim() || `jarkoman:${adminPassword()}`
}

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString('base64url')

function sign(payload: string): string {
  return b64url(createHmac('sha256', secret()).update(payload).digest())
}

/** Bandingkan dua string tanpa bocor informasi lewat waktu eksekusi (panjang berbeda pun aman). */
export function safeEqual(a: string, b: string): boolean {
  const key = 'jarkoman-compare'
  const ha = createHmac('sha256', key).update(a).digest()
  const hb = createHmac('sha256', key).update(b).digest()
  return timingSafeEqual(ha, hb)
}

export function checkPassword(input: unknown): boolean {
  if (!isConfigured() || typeof input !== 'string') return false
  return safeEqual(input, adminPassword())
}

export function issueToken(now = Date.now()): { token: string; exp: number } {
  const exp = now + TOKEN_TTL_MS
  const payload = b64url(JSON.stringify({ exp }))
  return { token: `${payload}.${sign(payload)}`, exp }
}

export function verifyToken(token: string | null | undefined, now = Date.now()): boolean {
  if (!token || !isConfigured()) return false
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false
  if (!safeEqual(signature, sign(payload))) return false
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number }
    return typeof exp === 'number' && exp > now
  } catch {
    return false
  }
}

export function bearer(req: Request): string | null {
  const header = req.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match ? match[1].trim() : null
}

/**
 * Kunci milik perangkat pendaftar untuk membatalkan atau mengubah pendaftarannya sendiri. Tidak disimpan di
 * server. Ditandatangani dengan rahasia pendaftar (lihat join-secret.ts), bukan rahasia sesi admin, supaya
 * mengganti password admin tidak mematikan tombol "Batal ikut" semua pemain.
 */
export function joinKey(itemId: string, playerId: string, joinSecret: string): string {
  return b64url(createHmac('sha256', joinSecret).update(`join:${itemId}:${playerId}`).digest())
}

export function verifyJoinKey(itemId: string, playerId: string, key: unknown, joinSecrets: string[]): boolean {
  if (typeof key !== 'string' || key.length === 0) return false
  let ok = false
  // Semua kandidat dicek (tanpa berhenti di yang pertama cocok) supaya waktu eksekusi tidak membocorkan apa pun.
  for (const s of joinSecrets) if (s && safeEqual(key, joinKey(itemId, playerId, s))) ok = true
  return ok
}

/** Rahasia lama yang dulu dipakai untuk kunci pendaftar, supaya kunci yang sudah dibagikan tetap berlaku. */
export function legacyJoinSecret(): string {
  // Kunci lama tanpa JARKOMAN_SECRET ditandatangani turunan password. Tanpa password, rahasia itu bisa ditebak
  // semua orang, jadi tidak diterima. (Kunci lama yang dibuat saat JARKOMAN_SECRET sudah ada tetap cocok lewat env.)
  return isConfigured() ? `jarkoman:${adminPassword()}` : ''
}
