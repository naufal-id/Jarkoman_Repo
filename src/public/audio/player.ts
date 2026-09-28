import type { Playback } from './procedural'

let shared: AudioContext | null = null

/** Satu AudioContext untuk seluruh halaman. Harus dibuat/di-resume dari aksi pengguna (klik). */
export async function getContext(): Promise<AudioContext> {
  if (!shared) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    shared = new Ctor()
  }
  if (shared.state !== 'running') await shared.resume()
  return shared
}

/** Putar file audio (lagu upload atau link) berulang dengan fade in dan fade out. */
export async function startFile(url: string, volume = 0.6): Promise<Playback> {
  const audio = new Audio()
  audio.src = url
  audio.loop = true
  audio.preload = 'auto'
  audio.volume = 0
  await Promise.race([
    audio.play(),
    new Promise((_, reject) => window.setTimeout(() => reject(new Error('timeout')), 20000)),
  ])
  let level = 0
  const fadeIn = window.setInterval(() => {
    level = Math.min(volume, level + volume / 24)
    audio.volume = level
    if (level >= volume) window.clearInterval(fadeIn)
  }, 50)
  let stopped = false
  return {
    stop() {
      if (stopped) return
      stopped = true
      window.clearInterval(fadeIn)
      let v = audio.volume
      const fadeOut = window.setInterval(() => {
        v = Math.max(0, v - volume / 10)
        audio.volume = v
        if (v <= 0) {
          window.clearInterval(fadeOut)
          audio.pause()
          audio.removeAttribute('src')
          audio.load()
        }
      }, 50)
    },
  }
}
