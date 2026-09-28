import type { Config } from '@netlify/functions'
import { bearer, checkPassword, isConfigured, issueToken, verifyToken } from '../lib/auth'
import { error, json, readJson } from '../lib/http'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default async function handler(req: Request): Promise<Response> {
  // GET: cek apakah password sudah diset dan apakah token yang dibawa masih berlaku.
  if (req.method === 'GET') {
    return json({ configured: isConfigured(), valid: verifyToken(bearer(req)) })
  }

  if (req.method !== 'POST') return error(405, 'Metode tidak didukung.')
  if (!isConfigured()) {
    return error(503, 'ADMIN_PASSWORD belum diset. Tambahkan di Netlify: Site configuration > Environment variables, lalu deploy ulang.', {
      code: 'not-configured',
    })
  }

  let body: { password?: unknown }
  try {
    body = (await readJson(req, 4_000)) as { password?: unknown }
  } catch {
    return error(400, 'Body harus JSON.')
  }

  if (!checkPassword(body?.password)) {
    // Jeda kecil memperlambat tebak-tebakan password.
    await sleep(700)
    return error(401, 'Password salah.', { code: 'wrong-password' })
  }

  return json(issueToken())
}

export const config: Config = {
  path: '/api/login',
  method: ['GET', 'POST'],
}
