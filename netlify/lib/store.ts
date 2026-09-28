import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getStore } from '@netlify/blobs'

export interface KV {
  getJSON<T>(key: string): Promise<T | null>
  setJSON(key: string, value: unknown): Promise<void>
}

let override: KV | null = null

/** Dipakai test untuk mengganti penyimpanan dengan versi di memori. */
export function setStoreForTests(kv: KV | null) {
  override = kv
}

export function memoryStore(): KV {
  const map = new Map<string, string>()
  return {
    async getJSON<T>(key: string) {
      const raw = map.get(key)
      return raw ? (JSON.parse(raw) as T) : null
    },
    async setJSON(key, value) {
      map.set(key, JSON.stringify(value))
    },
  }
}

/** Penyimpanan file untuk `npm run dev` (tanpa Netlify CLI). */
function fileStore(dir: string): KV {
  const path = (key: string) => join(dir, `${key.replace(/[^a-z0-9-]/gi, '_')}.json`)
  return {
    async getJSON<T>(key: string) {
      try {
        return JSON.parse(await readFile(path(key), 'utf8')) as T
      } catch {
        return null
      }
    },
    async setJSON(key, value) {
      await mkdir(dir, { recursive: true })
      const tmp = `${path(key)}.tmp`
      await writeFile(tmp, JSON.stringify(value, null, 2))
      await rename(tmp, path(key))
    },
  }
}

export function stateStore(): KV {
  if (override) return override
  const dir = process.env.JARKOMAN_DEV_STORE
  if (dir) return fileStore(dir)
  const store = getStore({ name: 'jarkoman', consistency: 'strong' })
  return {
    async getJSON<T>(key: string) {
      return (await store.get(key, { type: 'json' })) as T | null
    },
    async setJSON(key, value) {
      await store.setJSON(key, value)
    },
  }
}
