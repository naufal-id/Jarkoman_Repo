import { useEffect, useRef, useState } from 'react'
import { KEYS, readJSON, writeJSON } from '../../shared/storage'
import type { GameId } from '../../shared/types'
import { useReducedMotion } from './hooks'

/**
 * Intro diputar sekali per sesi browser untuk tiap game. Di preview admin, intro hanya jalan
 * saat admin menekan "putar ulang". Reduced motion mematikan intro sepenuhnya.
 */
export function useIntroGate(game: GameId, preview: boolean, replay: number) {
  const reduced = useReducedMotion()
  const [show, setShow] = useState(() => !reduced && !preview && !readJSON(KEYS.introSeen(game), 'session'))
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (replay > 0 && !reduced) setShow(true)
  }, [replay, reduced])

  useEffect(() => {
    if (reduced) setShow(false)
  }, [reduced])

  const done = () => {
    writeJSON(KEYS.introSeen(game), 1, 'session')
    setShow(false)
  }

  return { show, done, ready: !show }
}
