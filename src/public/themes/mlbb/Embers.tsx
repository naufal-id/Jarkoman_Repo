import { useEffect, useRef } from 'react'

/** Satu sprite bara bercahaya digambar sekali, lalu dipakai ulang tiap frame (jauh lebih murah dari shadowBlur). */
function sprite(core: string, glow: string, size: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const half = size / 2
  const grad = g.createRadialGradient(half, half, 0, half, half, half)
  grad.addColorStop(0, core)
  grad.addColorStop(0.18, core)
  grad.addColorStop(0.35, glow)
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return c
}

/**
 * Bara emas (dan sesekali biru mana) yang naik pelan di hero MLBB (suasana Land of Dawn).
 * Mulai setelah halaman tenang, berhenti saat tidak terlihat atau tab disembunyikan, dan tidak jalan sama sekali
 * saat reduced motion.
 */
export function Embers({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0
    let h = 0
    let raf = 0
    let visible = true
    let ready = false
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const count = window.innerWidth < 700 ? 18 : 40
    const gold = sprite('rgba(255, 240, 200, 1)', 'rgba(255, 196, 90, 0.45)', 48)
    const mana = sprite('rgba(220, 250, 255, 1)', 'rgba(110, 220, 255, 0.4)', 48)
    const parts = Array.from({ length: count }, () => spawn(true))

    function spawn(anywhere: boolean) {
      return {
        x: Math.random(),
        y: anywhere ? Math.random() : 1.05,
        r: 0.6 + Math.random() * 2.2,
        v: 0.00035 + Math.random() * 0.0009,
        drift: (Math.random() - 0.5) * 0.0004,
        phase: Math.random() * Math.PI * 2,
        mana: Math.random() >= 0.82,
      }
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const tick = (t: number) => {
      ctx.clearRect(0, 0, w, h)
      for (const p of parts) {
        p.y -= p.v
        p.x += p.drift + Math.sin(t / 1400 + p.phase) * 0.0002
        if (p.y < -0.05) Object.assign(p, spawn(false))
        const alpha = Math.min(1, (1 - p.y) * 1.4) * (0.35 + 0.35 * Math.sin(t / 500 + p.phase))
        if (alpha <= 0.01) continue
        // Sprite 48 px dengan inti ~18%: ukuran gambar = radius inti x 11 supaya cahayanya selebar shadowBlur 8 dulu.
        const size = p.r * 11
        ctx.globalAlpha = p.mana ? alpha * 0.8 : alpha
        ctx.drawImage(p.mana ? mana : gold, p.x * w - size / 2, p.y * h - size / 2, size, size)
      }
      ctx.globalAlpha = 1
      if (visible && !document.hidden) raf = requestAnimationFrame(tick)
    }

    const start = () => {
      cancelAnimationFrame(raf)
      if (ready && visible && !document.hidden) raf = requestAnimationFrame(tick)
    }

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      start()
    })
    io.observe(canvas)
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    document.addEventListener('visibilitychange', start)
    resize()
    // Jangan berebut CPU dengan gambar hero dan animasi pembuka: mulai saat browser senggang.
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200))
    const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout
    const idleId = idle(() => {
      ready = true
      start()
    })

    return () => {
      cancelIdle(idleId)
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', start)
    }
  }, [])

  return <canvas ref={ref} className={className} aria-hidden="true" />
}
