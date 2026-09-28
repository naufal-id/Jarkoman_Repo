export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json; charset=utf-8')
  if (!headers.has('cache-control')) headers.set('cache-control', 'no-store')
  return new Response(JSON.stringify(data), { ...init, headers })
}

export function error(status: number, message: string, extra: Record<string, unknown> = {}): Response {
  return json({ error: message, ...extra }, { status })
}

export async function readJson(req: Request, maxBytes = 256_000): Promise<unknown> {
  const text = await req.text()
  if (text.length > maxBytes) throw new Error('too-large')
  return JSON.parse(text)
}
