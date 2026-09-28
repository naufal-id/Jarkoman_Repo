import { useEffect, useMemo, useState } from 'react'
import { api } from '../../shared/api'
import { countdownParts, endEpoch, liveState, relativeDay, startEpoch } from '../../shared/time'
import type { GameId, Jarkoman, MediaPayload } from '../../shared/types'
import { isFull, playersIn } from '../../shared/wa'

export function useNow(interval = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), interval)
    return () => window.clearInterval(id)
  }, [interval])
  return now
}

export function useReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches)
  useEffect(() => {
    const mq = matchMedia(query)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

const mediaCache = new Map<GameId, Promise<MediaPayload | null>>()

/** Gambar resmi dari /api/media. Gagal = null, halaman tetap memakai artwork orisinal. */
export function useMedia(game: GameId): MediaPayload | null {
  const [data, setData] = useState<MediaPayload | null>(null)
  useEffect(() => {
    let alive = true
    setData(null)
    if (!mediaCache.has(game)) {
      mediaCache.set(
        game,
        api.media(game).catch(() => {
          mediaCache.delete(game)
          return null
        }),
      )
    }
    mediaCache.get(game)!.then((d) => alive && setData(d))
    return () => {
      alive = false
    }
  }, [game])
  return data
}

export function pageLink(j: Pick<Jarkoman, 'id'>): string {
  if (typeof location === 'undefined') return ''
  return `${location.origin}/?id=${encodeURIComponent(j.id)}`
}

export interface SessionInfo {
  state: ReturnType<typeof liveState>
  parts: ReturnType<typeof countdownParts>
  start: number | null
  end: number | null
  rel: string
  filled: number
  open: number
  full: boolean
}

export function useSession(j: Jarkoman): SessionInfo {
  const now = useNow(1000)
  return useMemo(() => {
    const start = startEpoch(j)
    const end = endEpoch(j)
    const state = liveState(j, now)
    const target = state === 'live' ? (end ?? now) : (start ?? now)
    const filled = playersIn(j)
    return {
      state,
      parts: countdownParts(target - now),
      start,
      end,
      rel: relativeDay(j, now),
      filled,
      open: Math.max(0, j.slots - filled),
      full: isFull(j),
    }
  }, [j, now])
}

/** Label status singkat yang dipakai semua tema. */
export function statusLabel(s: SessionInfo): string {
  switch (s.state) {
    case 'cancelled':
      return 'Dibatalkan'
    case 'ended':
      return 'Selesai'
    case 'live':
      return 'Lagi main'
    case 'unscheduled':
      return 'Jadwal belum pasti'
    default:
      return s.full ? 'Slot penuh' : `${s.open} slot kosong`
  }
}

export const isClosed = (s: SessionInfo) => s.state === 'cancelled' || s.state === 'ended'

/** Judul section form join, mengikuti status sesi. */
export function joinTitle(s: SessionInfo, openTitle: string): string {
  if (s.state === 'cancelled') return 'Sesi dibatalkan'
  if (s.state === 'ended') return 'Sesi selesai'
  return s.full ? 'Daftar cadangan' : openTitle
}
