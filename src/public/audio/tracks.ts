import type { GameId } from '../../shared/types'
import mlbbUrl from './tracks/mlbb.mp3?url'
import repoUrl from './tracks/repo.mp3?url'
import valorantUrl from './tracks/valorant.mp3?url'
import type { Playback } from './procedural'

export interface DefaultTrack {
  url: string
  title: string
  artist: string
  /** Penyama volume antarlagu (target sekitar -17 dB RMS) */
  gain: number
  /** Detik awal yang dilewati (hening di awal file) */
  start: number
  /** Lama crossfade di titik sambung loop, dalam detik */
  xfade: number
}

/**
 * Lagu bawaan per game (dari host). Klip ini dipotong di tengah lagu, jadi diputar berulang dengan
 * crossfade supaya sambungannya tidak terdengar patah. Game tanpa entri (saat ini CS2) memakai musik
 * sintetis di procedural.ts. Untuk menambah lagu CS2: taruh file di tracks/ lalu tambahkan entrinya di sini.
 * Nilai gain dan start diukur dari file aslinya (RMS dan hening di awal).
 */
export const DEFAULT_TRACKS: Partial<Record<GameId, DefaultTrack>> = {
  valorant: {
    url: valorantUrl,
    title: 'If The Sun Burns Out Tonight',
    artist: 'Grabbitz, Oli Sykes, Courtney LaPlante',
    gain: 0.95,
    start: 0.22,
    xfade: 2,
  },
  mlbb: {
    url: mlbbUrl,
    title: 'We Own This (Nyalakan Apimu)',
    artist: 'MPL Indonesia',
    gain: 0.36,
    start: 0.03,
    xfade: 1.2,
  },
  repo: {
    url: repoUrl,
    title: 'Main Menu',
    artist: 'R.E.P.O. Soundtrack, semiwork',
    gain: 1,
    start: 0.04,
    xfade: 1.6,
  },
}

export function trackFor(game: GameId): DefaultTrack | undefined {
  return DEFAULT_TRACKS[game]
}

const buffers = new Map<string, Promise<AudioBuffer>>()

function loadBuffer(ctx: BaseAudioContext, url: string): Promise<AudioBuffer> {
  let p = buffers.get(url)
  if (!p) {
    p = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`audio ${res.status}`)
        return res.arrayBuffer()
      })
      .then((data) => ctx.decodeAudioData(data))
    // Gagal (misalnya koneksi putus) tidak boleh tersimpan permanen.
    p.catch(() => buffers.delete(url))
    buffers.set(url, p)
  }
  return p
}

/** Kurva equal-power: volume total tetap rata selama dua lagu bertumpuk. */
function curve(rising: boolean): Float32Array<ArrayBuffer> {
  const n = 64
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1)
    out[i] = rising ? Math.sin((x * Math.PI) / 2) : Math.cos((x * Math.PI) / 2)
  }
  return out
}

/** Putar lagu bawaan berulang tanpa jeda, dengan crossfade di tiap sambungan dan fade in/out saat mulai/berhenti. */
export async function startTrack(ctx: AudioContext, track: DefaultTrack, volume = 0.6): Promise<Playback> {
  const buffer = await loadBuffer(ctx, track.url)
  const length = buffer.duration - track.start
  const xfade = Math.min(track.xfade, length / 4)
  // Jarak antara awal satu putaran dan putaran berikutnya.
  const period = length - xfade

  const master = ctx.createGain()
  master.gain.setValueAtTime(0, ctx.currentTime)
  master.gain.linearRampToValueAtTime(volume * track.gain, ctx.currentTime + 1.2)
  master.connect(ctx.destination)

  const voices = new Set<AudioBufferSourceNode>()
  const fadeIn = curve(true)
  const fadeOut = curve(false)
  let next = ctx.currentTime + 0.05
  let first = true

  const schedule = (at: number) => {
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const g = ctx.createGain()
    src.connect(g)
    g.connect(master)
    const end = at + length
    if (first) g.gain.setValueAtTime(1, at)
    else g.gain.setValueCurveAtTime(fadeIn, at, xfade)
    g.gain.setValueCurveAtTime(fadeOut, end - xfade, xfade)
    src.start(at, track.start)
    src.stop(end + 0.02)
    src.onended = () => {
      voices.delete(src)
      g.disconnect()
    }
    voices.add(src)
    first = false
  }

  const fill = () => {
    while (next < ctx.currentTime + 3) {
      schedule(next)
      next += period
    }
  }
  fill()
  const timer = window.setInterval(fill, 500)
  let stopped = false

  return {
    stop() {
      if (stopped) return
      stopped = true
      window.clearInterval(timer)
      const now = ctx.currentTime
      master.gain.cancelScheduledValues(now)
      master.gain.setValueAtTime(master.gain.value, now)
      master.gain.linearRampToValueAtTime(0, now + 0.6)
      window.setTimeout(() => {
        for (const v of voices) {
          try {
            v.stop()
          } catch {
            // Sudah berhenti.
          }
        }
        voices.clear()
        master.disconnect()
      }, 700)
    },
  }
}
