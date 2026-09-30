import type { GameId, Jarkoman, MediaPayload, Player, SiteState, StateResponse } from './types'

const EXT_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  webm: 'audio/webm',
}

/** Beberapa browser tidak mengisi file.type untuk .m4a/.flac, jadi tebak dari ekstensi. */
export function audioType(file: Pick<File, 'type' | 'name'>): string {
  if (file.type.startsWith('audio/')) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return EXT_TYPES[ext] ?? 'application/octet-stream'
}

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
  /** Dengan token admin, catatan pemain ikut dikirim; tanpa token (halaman publik) catatan dikosongkan server. */
  async getState(token?: string): Promise<SiteState | null> {
    const data = await request<StateResponse>('/api/state', { cache: 'no-store', headers: token ? { authorization: `Bearer ${token}` } : undefined })
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
  uploadAudio(file: File, token: string) {
    return request<{ url: string; size: number }>(
      '/api/audio',
      { method: 'POST', headers: { 'content-type': audioType(file), authorization: `Bearer ${token}` }, body: file },
      90000,
    )
  },
  /** Pemain mendaftar sendiri. `key` disimpan di perangkat untuk membatalkan nanti. */
  join(input: { id: string; name: string; role: string; pick: string; note: string; website: string }) {
    return request<{ item: Jarkoman; player: Player; key: string; slot: number | null }>('/api/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
  },
  leave(id: string, player: string, key: string) {
    return request<{ item: Jarkoman }>('/api/join', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, player, key }),
    })
  },
  media(game: GameId) {
    return request<MediaPayload>(`/api/media?game=${game}`, {}, 15000)
  },
}
