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

/* ---------- File audio (lagu upload admin) ---------- */

export interface AudioFile {
  data: ArrayBuffer
  contentType: string
  uploadedAt: number
}

export interface AudioStore {
  get(key: string): Promise<AudioFile | null>
  set(key: string, data: ArrayBuffer, contentType: string, uploadedAt: number): Promise<void>
  delete(key: string): Promise<void>
  list(): Promise<{ key: string; uploadedAt: number }[]>
}

let audioOverride: AudioStore | null = null

export function setAudioStoreForTests(s: AudioStore | null) {
  audioOverride = s
}

export function memoryAudioStore(): AudioStore {
  const map = new Map<string, AudioFile>()
  return {
    async get(key) {
      return map.get(key) ?? null
    },
    async set(key, data, contentType, uploadedAt) {
      map.set(key, { data, contentType, uploadedAt })
    },
    async delete(key) {
      map.delete(key)
    },
    async list() {
      return [...map.entries()].map(([key, f]) => ({ key, uploadedAt: f.uploadedAt }))
    },
  }
}

function fileAudioStore(dir: string): AudioStore {
  const base = join(dir, 'audio')
  const safe = (key: string) => key.replace(/[^a-z0-9]/gi, '_')
  return {
    async get(key) {
      try {
        const meta = JSON.parse(await readFile(join(base, `${safe(key)}.json`), 'utf8')) as { contentType: string; uploadedAt: number }
        const buf = await readFile(join(base, `${safe(key)}.bin`))
        return { data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, ...meta }
      } catch {
        return null
      }
    },
    async set(key, data, contentType, uploadedAt) {
      await mkdir(base, { recursive: true })
      await writeFile(join(base, `${safe(key)}.bin`), Buffer.from(data))
      await writeFile(join(base, `${safe(key)}.json`), JSON.stringify({ contentType, uploadedAt }))
    },
    async delete(key) {
      const { rm } = await import('node:fs/promises')
      await rm(join(base, `${safe(key)}.bin`), { force: true })
      await rm(join(base, `${safe(key)}.json`), { force: true })
    },
    async list() {
      const { readdir } = await import('node:fs/promises')
      try {
        const files = (await readdir(base)).filter((f) => f.endsWith('.json'))
        return Promise.all(
          files.map(async (f) => {
            const meta = JSON.parse(await readFile(join(base, f), 'utf8')) as { uploadedAt: number }
            return { key: f.replace(/\.json$/, ''), uploadedAt: meta.uploadedAt }
          }),
        )
      } catch {
        return []
      }
    },
  }
}

export function audioStore(): AudioStore {
  if (audioOverride) return audioOverride
  const dir = process.env.JARKOMAN_DEV_STORE
  if (dir) return fileAudioStore(dir)
  const store = getStore({ name: 'jarkoman-audio', consistency: 'strong' })
  return {
    async get(key) {
      const res = await store.getWithMetadata(key, { type: 'arrayBuffer' })
      if (!res) return null
      const meta = res.metadata as { contentType?: string; uploadedAt?: number }
      return { data: res.data, contentType: meta.contentType ?? 'audio/mpeg', uploadedAt: Number(meta.uploadedAt ?? 0) }
    },
    async set(key, data, contentType, uploadedAt) {
      await store.set(key, data, { metadata: { contentType, uploadedAt } })
    },
    async delete(key) {
      await store.delete(key)
    },
    async list() {
      const { blobs } = await store.list()
      return Promise.all(
        blobs.map(async (b) => {
          const meta = await store.getMetadata(b.key)
          return { key: b.key, uploadedAt: Number((meta?.metadata as { uploadedAt?: number } | undefined)?.uploadedAt ?? 0) }
        }),
      )
    },
  }
}
