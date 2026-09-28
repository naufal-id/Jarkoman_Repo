// Semua akses storage dibungkus try/catch: mode privat, storage diblokir, atau iframe sandbox bisa melempar error.

export function readJSON<T>(key: string, area: 'local' | 'session' = 'local'): T | null {
  try {
    const raw = (area === 'local' ? localStorage : sessionStorage).getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeJSON(key: string, value: unknown, area: 'local' | 'session' = 'local'): void {
  try {
    ;(area === 'local' ? localStorage : sessionStorage).setItem(key, JSON.stringify(value))
  } catch {
    // Tidak apa-apa: storage hanya kenyamanan, bukan sumber data utama.
  }
}

export function removeKey(key: string, area: 'local' | 'session' = 'local'): void {
  try {
    ;(area === 'local' ? localStorage : sessionStorage).removeItem(key)
  } catch {
    // abaikan
  }
}

export const KEYS = {
  lastState: 'jk:last-state',
  token: 'jk:admin-token',
  draft: 'jk:admin-draft',
  introSeen: (game: string) => `jk:intro:${game}`,
  joinName: 'jk:join-name',
  previewDevice: 'jk:preview-device',
}
