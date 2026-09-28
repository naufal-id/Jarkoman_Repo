import { useEffect, useRef } from 'react'

/**
 * Bara emas yang naik pelan di hero MLBB (suasana Land of Dawn).
 * Berhenti saat tidak terlihat atau tab disembunyikan, dan tidak jalan sama sekali saat reduced motion.
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
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const count = window.innerWidth < 700 ? 22 : 46
    const parts = Array.from({ length: count }, () => spawn(true))

    function spawn(anywhere: boolean) {
      return {
        x: Math.random(),
        y: anywhere ? Math.random() : 1.05,
        r: 0.6 + Math.random() * 2.2,
        v: 0.00035 + Math.random() * 0.0009,
        drift: (Math.random() - 0.5) * 0.0004,
        phase: Math.random() * Math.PI * 2,
        hue: Math.random() < 0.82 ? 42 : 190,
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
        ctx.beginPath()
        ctx.fillStyle = p.hue === 42 ? `rgba(255, 214, 120, ${alpha})` : `rgba(120, 230, 255, ${alpha * 0.8})`
        ctx.shadowColor = ctx.fillStyle
        ctx.shadowBlur = 8
        ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      if (visible && !document.hidden) raf = requestAnimationFrame(tick)
    }

    const start = () => {
      cancelAnimationFrame(raf)
      if (visible && !document.hidden) raf = requestAnimationFrame(tick)
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
    start()

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', start)
    }
  }, [])

  return <canvas ref={ref} className={className} aria-hidden="true" />
}
