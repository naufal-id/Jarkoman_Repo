import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { KEYS, readJSON, writeJSON } from '../shared/storage'
import type { Jarkoman } from '../shared/types'

type Device = 'desktop' | 'mobile'

const SIZES: Record<Device, { w: number; h: number }> = {
  desktop: { w: 1280, h: 800 },
  mobile: { w: 390, h: 844 },
}

interface PreviewProps {
  item: Jarkoman
  others: Jarkoman[]
  replay: number
  published: boolean
}

/**
 * Preview memakai halaman publik asli di dalam iframe (/?preview=1), jadi yang terlihat di sini
 * sama persis dengan yang dilihat pengunjung. Data dikirim lewat postMessage ke origin yang sama.
 */
export function Preview({ item, others, replay, published }: PreviewProps) {
  const [device, setDevice] = useState<Device>(() => (readJSON<Device>(KEYS.previewDevice) === 'mobile' ? 'mobile' : 'desktop'))
  // Naik setiap iframe mengirim jk:ready (termasuk setelah reload), supaya data dikirim ulang.
  const [readyTick, setReadyTick] = useState(0)
  // Fokus di dalam iframe tidak memicu :focus-within di halaman induk, jadi cincin fokus dipasang lewat state.
  const [framed, setFramed] = useState(false)
  useEffect(() => {
    let t = 0
    const check = () => {
      window.clearTimeout(t)
      t = window.setTimeout(() => setFramed(document.activeElement === frame.current), 0)
    }
    window.addEventListener('blur', check)
    window.addEventListener('focus', check)
    document.addEventListener('focusin', check)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('blur', check)
      window.removeEventListener('focus', check)
      document.removeEventListener('focusin', check)
    }
  }, [])
  const ready = readyTick > 0
  const [box, setBox] = useState({ w: 0, h: 0 })
  const frame = useRef<HTMLIFrameElement>(null)
  const stage = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = stage.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setBox({ w: entry.contentRect.width, h: entry.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return
      if (e.data?.type === 'jk:ready') setReadyTick((n) => n + 1)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    if (!ready) return
    const t = window.setTimeout(() => {
      frame.current?.contentWindow?.postMessage({ type: 'jk:preview', item, others }, location.origin)
    }, 90)
    return () => window.clearTimeout(t)
  }, [item, others, ready, readyTick])

  useEffect(() => {
    if (!ready || replay === 0) return
    const t = window.setTimeout(() => frame.current?.contentWindow?.postMessage({ type: 'jk:replay' }, location.origin), 260)
    return () => window.clearTimeout(t)
  }, [replay, ready])

  const size = SIZES[device]
  const pad = 16
  const availW = Math.max(0, box.w - pad * 2)
  const availH = Math.max(0, box.h - pad * 2)
  const scale = device === 'desktop' ? Math.min(1, availW / size.w) : Math.min(1, availW / size.w, availH / size.h)
  const frameH = device === 'desktop' ? Math.max(size.h, availH / (scale || 1)) : size.h

  const choose = (d: Device) => {
    setDevice(d)
    writeJSON(KEYS.previewDevice, d)
  }

  return (
    <div className="adm-preview">
      <div className="adm-preview__bar">
        <div className="adm-seg adm-seg--sm" role="radiogroup" aria-label="Ukuran preview">
          {(['desktop', 'mobile'] as Device[]).map((d) => (
            <label key={d} className={`adm-seg__opt ${device === d ? 'is-on' : ''}`}>
              <input type="radio" name="device" checked={device === d} onChange={() => choose(d)} />
              <span>{d === 'desktop' ? 'Desktop' : 'HP'}</span>
            </label>
          ))}
        </div>
        <button
          type="button"
          className="adm-btn adm-btn--ghost adm-btn--sm"
          disabled={!ready}
          onClick={() => frame.current?.contentWindow?.postMessage({ type: 'jk:replay' }, location.origin)}
        >
          Putar intro
        </button>
        {published ? (
          <a className="adm-btn adm-btn--ghost adm-btn--sm" href={`/?id=${encodeURIComponent(item.id)}`} target="_blank" rel="noopener noreferrer">
            Buka halaman
          </a>
        ) : (
          <span className="adm-preview__note">Belum dipublikasikan</span>
        )}
      </div>
      <div className="adm-preview__stage" ref={stage} data-device={device}>
        {!ready && (
          <p className="adm-preview__loading" role="status">
            Memuat preview…
          </p>
        )}
        <div className="adm-preview__frame" data-focused={framed || undefined} style={{ width: size.w * scale, height: frameH * scale }}>
          <iframe ref={frame} title="Preview halaman jarkoman" src="/?preview=1" style={{ width: size.w, height: frameH, transform: `scale(${scale})` }} />
        </div>
      </div>
    </div>
  )
}
