import type { GameId, MediaPayload, SiteState, StateResponse } from './types'

export class ApiError extends Error {
  status: number
  code: string
  data: Record<string, unknown>
  constructor(message: string, status: number, code = '', data: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.code = code
    this.data = data
  }
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 12000): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  } catch (err) {
    const timeout = err instanceof DOMException && err.name === 'TimeoutError'
    throw new ApiError(timeout ? 'Server terlalu lama merespons.' : 'Tidak bisa terhubung ke server.', 0, 'network')
  }
  const type = res.headers.get('content-type') ?? ''
  if (!type.includes('application/json')) {
    // Tanpa Netlify Functions (misalnya file statis dibuka langsung), /api/* akan mengembalikan HTML atau 404.
    throw new ApiError('API tidak tersedia di hosting ini.', res.status, 'no-api')
  }
  const data = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    throw new ApiError(String(data.error ?? `Error ${res.status}`), res.status, String(data.code ?? ''), data)
  }
  return data as T
}

export const api = {
  async getState(): Promise<SiteState | null> {
    const data = await request<StateResponse>('/api/state', { cache: 'no-store' })
    return data.state
  },
  login(password: string) {
    return request<{ token: string; exp: number }>('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    })
  },
  session(token: string | null) {
    return request<{ configured: boolean; valid: boolean }>('/api/login', {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
    })
  },
  async saveState(state: SiteState, token: string, baseUpdatedAt: number, force = false): Promise<SiteState> {
    const data = await request<{ state: SiteState }>('/api/state', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ state, baseUpdatedAt, force }),
    })
    return data.state
  },
  media(game: GameId) {
    return request<MediaPayload>(`/api/media?game=${game}`, {}, 15000)
  },
}
