import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getStore } from '@netlify/blobs'

export interface Versioned<T> {
  value: T | null
  /** Versi isi saat dibaca. null = key belum ada. */
  etag: string | null
}

export interface KV {
  getJSON<T>(key: string): Promise<T | null>
  setJSON(key: string, value: unknown): Promise<void>
  getVersioned<T>(key: string): Promise<Versioned<T>>
  /** Tulis hanya kalau isi belum berubah sejak dibaca (etag null = hanya kalau key belum ada). false = kalah balapan. */
  setIfMatch(key: string, value: unknown, etag: string | null): Promise<boolean>
}

/** Balapan tulis yang terus kalah setelah beberapa kali coba. */
export class WriteConflictError extends Error {}

/**
 * Baca, ubah, lalu tulis bersyarat. Kalau ada penulis lain di antaranya (misalnya dua pemain menekan
 * LOCK IN bersamaan, atau admin menyimpan), baca ulang dan ulangi supaya tidak ada perubahan yang tertimpa.
 * `change` bisa mengembalikan `value: undefined` (atau melempar error) untuk selesai tanpa menulis apa pun.
 */
export async function updateJSON<T, R>(kv: KV, key: string, change: (current: T | null) => { value?: T; result: R }, attempts = 6): Promise<R> {
  for (let i = 0; i < attempts; i++) {
    const { value, etag } = await kv.getVersioned<T>(key)
    const next = change(value)
    if (next.value === undefined) return next.result
    if (await kv.setIfMatch(key, next.value, etag)) return next.result
    await new Promise((r) => setTimeout(r, 15 + Math.random() * 40 * (i + 1)))
  }
  throw new WriteConflictError('Terlalu banyak perubahan bersamaan.')
}

const hash = (raw: string) => createHash('sha1').update(raw).digest('hex')

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
    async getVersioned<T>(key: string) {
      const raw = map.get(key)
      return raw ? { value: JSON.parse(raw) as T, etag: hash(raw) } : { value: null, etag: null }
    },
    async setIfMatch(key, value, etag) {
      const raw = map.get(key)
      if ((raw === undefined ? null : hash(raw)) !== etag) return false
      map.set(key, JSON.stringify(value))
      return true
    },
  }
}

/** Penyimpanan file untuk `npm run dev` (tanpa Netlify CLI). */
function fileStore(dir: string): KV {
  const path = (key: string) => join(dir, `${key.replace(/[^a-z0-9-]/gi, '_')}.json`)
  const raw = (key: string): Promise<string | null> => readFile(path(key), 'utf8').catch(() => null)
  const write = async (key: string, value: unknown) => {
    await mkdir(dir, { recursive: true })
    const tmp = `${path(key)}.${process.pid}.${Date.now()}.tmp`
    await writeFile(tmp, JSON.stringify(value, null, 2))
    await rename(tmp, path(key))
  }
  return {
    async getJSON<T>(key: string) {
      const text = await raw(key)
      try {
        return text ? (JSON.parse(text) as T) : null
      } catch {
        return null
      }
    },
    setJSON: write,
    async getVersioned<T>(key: string) {
      const text = await raw(key)
      if (!text) return { value: null, etag: null }
      try {
        return { value: JSON.parse(text) as T, etag: hash(text) }
      } catch {
        return { value: null, etag: hash(text) }
      }
    },
    // Cukup untuk dev lokal (satu proses); di Netlify dipakai tulis bersyarat milik Blobs.
    async setIfMatch(key, value, etag) {
      const text = await raw(key)
      if ((text === null ? null : hash(text)) !== etag) return false
      await write(key, value)
      return true
    },
  }
}

let shared: { key: string; kv: KV } | null = null

/** Satu objek store per proses (per folder dev), supaya cache yang dikunci per store (rahasia pendaftar) bekerja. */
export function stateStore(): KV {
  if (override) return override
  const dir = process.env.JARKOMAN_DEV_STORE
  const key = dir ? `file:${dir}` : 'blobs'
  if (shared?.key === key) return shared.kv
  const kv = dir ? fileStore(dir) : blobStateStore()
  shared = { key, kv }
  return kv
}

function blobStateStore(): KV {
  const store = getStore({ name: 'jarkoman', consistency: 'strong' })
  return {
    async getJSON<T>(key: string) {
      return (await store.get(key, { type: 'json' })) as T | null
    },
    async setJSON(key, value) {
      await store.setJSON(key, value)
    },
    async getVersioned<T>(key: string) {
      const res = await store.getWithMetadata(key, { type: 'json' })
      return res ? { value: res.data as T, etag: res.etag ?? null } : { value: null, etag: null }
    },
    async setIfMatch(key, value, etag) {
      const res = await store.setJSON(key, value, etag ? { onlyIfMatch: etag } : { onlyIfNew: true })
      return res.modified
    },
  }
}

/* ---------- File audio (lagu upload admin) ---------- */

export interface AudioFile {
  data: ArrayBuffer
  contentType: string
  uploadedAt: number
  /** Tanda versi isi (dipakai gambar OG: berubah kalau judul, jadwal, atau gambar jarkoman berubah) */
  sig?: string
}

/** Penyimpanan file biner (lagu upload, gambar OG). */
export interface AudioStore {
  get(key: string): Promise<AudioFile | null>
  set(key: string, data: ArrayBuffer, contentType: string, uploadedAt: number, sig?: string): Promise<void>
  delete(key: string): Promise<void>
  list(): Promise<{ key: string; uploadedAt: number }[]>
}

export type BinaryStore = AudioStore

let audioOverride: AudioStore | null = null
let ogOverride: BinaryStore | null = null

export function setAudioStoreForTests(s: AudioStore | null) {
  audioOverride = s
}

export function setOgStoreForTests(s: BinaryStore | null) {
  ogOverride = s
}

export function memoryAudioStore(): AudioStore {
  const map = new Map<string, AudioFile>()
  return {
    async get(key) {
      return map.get(key) ?? null
    },
    async set(key, data, contentType, uploadedAt, sig) {
      map.set(key, { data, contentType, uploadedAt, sig })
    },
    async delete(key) {
      map.delete(key)
    },
    async list() {
      return [...map.entries()].map(([key, f]) => ({ key, uploadedAt: f.uploadedAt }))
    },
  }
}

function fileBinaryStore(dir: string, folder: string): BinaryStore {
  const base = join(dir, folder)
  const safe = (key: string) => key.replace(/[^a-z0-9]/gi, '_')
  return {
    async get(key) {
      try {
        const meta = JSON.parse(await readFile(join(base, `${safe(key)}.json`), 'utf8')) as { contentType: string; uploadedAt: number; sig?: string }
        const buf = await readFile(join(base, `${safe(key)}.bin`))
        return { data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, ...meta }
      } catch {
        return null
      }
    },
    async set(key, data, contentType, uploadedAt, sig) {
      await mkdir(base, { recursive: true })
      await writeFile(join(base, `${safe(key)}.bin`), Buffer.from(data))
      await writeFile(join(base, `${safe(key)}.json`), JSON.stringify({ contentType, uploadedAt, sig }))
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

function blobBinaryStore(name: string, defaultType: string): BinaryStore {
  const store = getStore({ name, consistency: 'strong' })
  return {
    async get(key) {
      const res = await store.getWithMetadata(key, { type: 'arrayBuffer' })
      if (!res) return null
      const meta = res.metadata as { contentType?: string; uploadedAt?: number; sig?: string }
      return { data: res.data, contentType: meta.contentType ?? defaultType, uploadedAt: Number(meta.uploadedAt ?? 0), sig: meta.sig }
    },
    async set(key, data, contentType, uploadedAt, sig) {
      await store.set(key, data, { metadata: { contentType, uploadedAt, ...(sig ? { sig } : {}) } })
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

export function audioStore(): AudioStore {
  if (audioOverride) return audioOverride
  const dir = process.env.JARKOMAN_DEV_STORE
  if (dir) return fileBinaryStore(dir, 'audio')
  return blobBinaryStore('jarkoman-audio', 'audio/mpeg')
}

/** Gambar preview link (OG) per jarkoman, dibuat dashboard admin saat menyimpan. */
export function ogStore(): BinaryStore {
  if (ogOverride) return ogOverride
  const dir = process.env.JARKOMAN_DEV_STORE
  if (dir) return fileBinaryStore(dir, 'og')
  return blobBinaryStore('jarkoman-og', 'image/jpeg')
}
