import { createContext, useContext } from 'react'
import type { Jarkoman, MediaPayload } from '../../shared/types'

export interface PageContext {
  /** Dirender di dalam iframe preview admin */
  preview: boolean
  /** Jarkoman lain untuk bagian "jadwal lain" */
  others: Jarkoman[]
  /** Nilai berubah saat admin menekan "putar ulang intro" */
  replay: number
  media: MediaPayload | null
  /** Intro selesai (atau dilewati), animasi hero boleh jalan */
  ready: boolean
}

export const PageCtx = createContext<PageContext>({ preview: false, others: [], replay: 0, media: null, ready: true })

export const usePage = () => useContext(PageCtx)

export interface ThemeProps {
  j: Jarkoman
}
