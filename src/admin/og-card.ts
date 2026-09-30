import { KEY_ART } from '../shared/art'
import { gameDef } from '../shared/games'
import { formatDateLong, formatTimeRange } from '../shared/time'
import type { GameId, Jarkoman } from '../shared/types'
import { CS2_MAPS } from '../public/themes/cs2/maps'

/*
 * Gambar preview link (1200 x 630) digambar di canvas dengan bahasa visual tiap tema. Dipakai dua cara:
 * - dashboard admin membuat gambar khusus per jarkoman (judul dan jadwal tertulis) setiap menyimpan;
 * - tools/render-og.mjs membuat ulang gambar bawaan per game di public/og.
 */

export const OG_W = 1200
export const OG_H = 630
/** Naikkan kalau desain gambar berubah, supaya semua gambar lama dibuat ulang. */
export const OG_VERSION = 1

export interface OgContent {
  game: GameId
  variant: string
  /** Judul besar */
  title: string
  /** Baris kecil di atas judul */
  kicker: string
  /** Satu atau dua baris keterangan di bawah judul */
  lines: string[]
  /** Teks tombol */
  cta: string
  /** Keterangan kecil di samping tombol */
  ctaNote: string
  /** URL gambar pilihan admin; kosong = key art bawaan */
  bg?: string
  /** Kode map CS2 (de_mirage) untuk tag di atas layar key art */
  mapCode?: string
  /** Warna khas map CS2 */
  tint?: string
}

/** Isi gambar untuk satu jarkoman. */
export function ogContentFor(j: Jarkoman): OgContent {
  const def = gameDef(j.game)
  const known = j.game === 'cs2' ? CS2_MAPS[j.map] : undefined
  const when = [formatDateLong(j.date), formatTimeRange(j)].filter(Boolean).join(' · ')
  const where = [j.mode, j.map].filter(Boolean).join(' · ')
  return {
    game: j.game,
    variant: j.variant,
    title: j.headline,
    // Kode map CS2 (de_mirage) sudah tampil di tag layar key art, jadi kicker cukup mode.
    kicker: j.game === 'cs2' ? j.mode || def.name : `${def.fullName} · mabar`,
    lines: [when, where].filter(Boolean),
    cta: def.cta,
    ctaNote: j.autoJoin ? 'Isi nama, langsung masuk skuad' : 'Konfirmasi lewat WhatsApp',
    bg: j.bg || undefined,
    mapCode: known?.code,
    tint: known?.tint,
  }
}

/** Tanda versi isi gambar: berubah kalau yang tertulis atau tergambar berubah. */
export function ogSignature(j: Jarkoman): string {
  const c = ogContentFor(j)
  const raw = JSON.stringify([OG_VERSION, c.game, c.variant, c.title, c.kicker, c.lines, c.cta, c.ctaNote, c.bg ?? ''])
  // FNV-1a 32 bit, cukup untuk mendeteksi perubahan.
  let h = 0x811c9dc5
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}

const FONT_CSS: Record<GameId, (() => Promise<unknown>)[]> = {
  valorant: [() => import('@fontsource/anton/400.css'), () => import('@fontsource/barlow/600.css'), () => import('@fontsource/barlow/800.css')],
  cs2: [() => import('@fontsource/saira-condensed/800.css'), () => import('@fontsource/rajdhani/600.css'), () => import('@fontsource/rajdhani/700.css')],
  mlbb: [() => import('@fontsource/rubik/600.css'), () => import('@fontsource/rubik/800.css'), () => import('@fontsource/rubik/900.css')],
  repo: [() => import('@fontsource/teko/600.css'), () => import('@fontsource/vt323/400.css')],
}

const FONT_FACES: Record<GameId, string[]> = {
  valorant: ['400 40px Anton', '600 20px Barlow', '800 20px Barlow'],
  cs2: ['800 40px "Saira Condensed"', '600 20px Rajdhani', '700 20px Rajdhani'],
  mlbb: ['600 20px Rubik', '800 20px Rubik', '900 40px Rubik'],
  repo: ['600 40px Teko', '400 20px VT323'],
}

async function ensureFonts(game: GameId) {
  await Promise.all(FONT_CSS[game].map((load) => load().catch(() => null)))
  await Promise.all(FONT_FACES[game].map((f) => document.fonts.load(f).catch(() => null)))
}

function loadImage(src: string, cross: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (cross) img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`gagal memuat ${src}`))
    img.src = src
  })
}

/** Gambar latar: pilihan admin kalau bisa dipakai di canvas (CORS), kalau tidak key art bawaan. */
async function artFor(c: OgContent): Promise<HTMLImageElement> {
  if (c.bg) {
    try {
      const img = await loadImage(c.bg, true)
      // Uji apakah canvas tetap bisa diekspor dengan gambar ini.
      const probe = document.createElement('canvas')
      probe.width = probe.height = 2
      probe.getContext('2d')!.drawImage(img, 0, 0, 2, 2)
      probe.toDataURL()
      return img
    } catch {
      // Server gambar tidak mengizinkan CORS: pakai key art.
    }
  }
  return loadImage(KEY_ART[c.game].src, false)
}

/** Gambar `img` menutupi kotak (seperti object-fit: cover) dengan titik fokus fx, fy (0 sampai 1). */
function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, fx = 0.5, fy = 0.5) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const sw = w / s
  const sh = h / s
  const sx = (img.naturalWidth - sw) * fx
  const sy = (img.naturalHeight - sh) * fy
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

/** Pecah teks menjadi paling banyak `maxLines` baris dengan ukuran huruf terbesar yang muat. */
function fit(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, maxW: number, start: number, min: number, maxLines = 2) {
  const words = text.split(/\s+/).filter(Boolean)
  for (let px = start; px >= min; px -= 2) {
    ctx.font = font(px)
    const lines: string[] = []
    let line = ''
    for (const w of words) {
      const test = line ? `${line} ${w}` : w
      if (ctx.measureText(test).width <= maxW || !line) line = test
      else {
        lines.push(line)
        line = w
      }
    }
    if (line) lines.push(line)
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxW)) return { px, lines }
  }
  ctx.font = font(min)
  return { px: min, lines: [text] }
}

/** Ukuran huruf yang sama untuk semua baris keterangan: yang terpanjang menentukan. */
function fitAll(ctx: CanvasRenderingContext2D, lines: string[], font: (px: number) => string, maxW: number, start: number, min: number) {
  return Math.min(start, ...lines.map((l) => fit(ctx, l, font, maxW, start, min, 1).px))
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: 'left' | 'center' = 'left') {
  const chars = [...text]
  const width = chars.reduce((w, ch) => w + ctx.measureText(ch).width + spacing, -spacing)
  let cx = align === 'center' ? x - width / 2 : x
  for (const ch of chars) {
    ctx.fillText(ch, cx, y)
    cx += ctx.measureText(ch).width + spacing
  }
  return width
}

function drawValorant(ctx: CanvasRenderingContext2D, c: OgContent, art: HTMLImageElement) {
  const light = c.variant === 'bone'
  const ink = '#0f1923'
  const bone = '#ece8e1'
  const red = '#ff4655'
  ctx.fillStyle = light ? bone : ink
  ctx.fillRect(0, 0, OG_W, OG_H)
  // Key art di panel kanan bertepi diagonal, seperti hero halaman.
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(560, 0)
  ctx.lineTo(OG_W, 0)
  ctx.lineTo(OG_W, OG_H)
  ctx.lineTo(430, OG_H)
  ctx.closePath()
  ctx.clip()
  cover(ctx, art, 430, 0, OG_W - 430, OG_H, 0.4, 0.3)
  ctx.restore()
  ctx.fillStyle = red
  ctx.beginPath()
  ctx.moveTo(546, 0)
  ctx.lineTo(560, 0)
  ctx.lineTo(430, OG_H)
  ctx.lineTo(416, OG_H)
  ctx.closePath()
  ctx.fill()

  const fg = light ? ink : bone
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = fg
  ctx.font = '400 30px Anton'
  ctx.fillText('JARKOMAN', 56, 76)
  ctx.fillStyle = light ? '#b51f31' : red
  ctx.font = '800 20px Barlow'
  spaced(ctx, c.kicker.toUpperCase(), 56, 150, 3)
  const t = fit(ctx, c.title.toUpperCase(), (px) => `400 ${px}px Anton`, 400, 110, 56, 3)
  ctx.fillStyle = fg
  ctx.font = `400 ${t.px}px Anton`
  t.lines.forEach((l, i) => ctx.fillText(l, 52, 160 + t.px * 0.95 * (i + 1)))
  let y = 160 + t.px * 0.95 * t.lines.length + 46
  ctx.fillStyle = light ? '#4e5a66' : '#a9b2ba'
  const vpx = fitAll(ctx, c.lines.slice(0, 2), (px) => `600 ${px}px Barlow`, 370, 24, 16)
  ctx.font = `600 ${vpx}px Barlow`
  for (const l of c.lines.slice(0, 2)) {
    ctx.fillText(l, 56, y)
    y += vpx + 10
  }
  // Tombol LOCK IN bersudut terpotong.
  const bx = 56
  const by = 520
  const bw = 230
  const bh = 64
  ctx.fillStyle = red
  ctx.beginPath()
  ctx.moveTo(bx, by)
  ctx.lineTo(bx + bw, by)
  ctx.lineTo(bx + bw, by + bh - 14)
  ctx.lineTo(bx + bw - 14, by + bh)
  ctx.lineTo(bx, by + bh)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = ink
  ctx.font = '800 26px Barlow'
  spaced(ctx, c.cta.toUpperCase(), bx + bw / 2, by + 42, 4, 'center')
  ctx.fillStyle = fg
  const note = fit(ctx, c.ctaNote, (px) => `600 ${px}px Barlow`, 110, 18, 13, 2)
  ctx.font = `600 ${note.px}px Barlow`
  note.lines.forEach((l, i) => ctx.fillText(l, bx + bw + 18, by + 30 + i * (note.px + 4) - (note.lines.length - 1) * 6))
}

function drawCs2(ctx: CanvasRenderingContext2D, c: OgContent, art: HTMLImageElement) {
  const ct = c.variant === 'ct'
  const accent = ct ? '#96c8fa' : '#eabe54'
  const tint = c.tint ?? '#f09a2c'
  const bg = ctx.createLinearGradient(0, 0, OG_W * 0.4, OG_H)
  bg.addColorStop(0, '#1e2d3d')
  bg.addColorStop(0.45, '#14202b')
  bg.addColorStop(1, '#0a1118')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, OG_W, OG_H)
  const glow = ctx.createRadialGradient(900, 300, 20, 900, 300, 520)
  glow.addColorStop(0, `${tint}66`)
  glow.addColorStop(1, `${tint}00`)
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, OG_W, OG_H)
  // Garis cahaya diagonal tipis seperti key art.
  ctx.save()
  ctx.globalAlpha = 0.12
  ctx.strokeStyle = '#f09a2c'
  ctx.lineWidth = 2
  for (let x = 560; x < 1400; x += 70) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x - 300, OG_H)
    ctx.stroke()
  }
  ctx.restore()
  // Layar key art ber-HUD.
  const sx = 620
  const sy = 150
  const sw = 530
  const sh = 304
  ctx.fillStyle = '#000'
  ctx.fillRect(sx - 6, sy - 6, sw + 12, sh + 12)
  cover(ctx, art, sx, sy, sw, sh)
  ctx.strokeStyle = 'rgba(181, 212, 238, 0.4)'
  ctx.lineWidth = 1
  ctx.strokeRect(sx - 6.5, sy - 6.5, sw + 13, sh + 13)
  ctx.strokeStyle = accent
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(sx - 8, sy + 22)
  ctx.lineTo(sx - 8, sy - 8)
  ctx.lineTo(sx + 22, sy - 8)
  ctx.moveTo(sx + sw + 8, sy + sh - 22)
  ctx.lineTo(sx + sw + 8, sy + sh + 8)
  ctx.lineTo(sx + sw - 22, sy + sh + 8)
  ctx.stroke()
  if (c.mapCode) {
    ctx.font = '700 22px Rajdhani'
    const w = ctx.measureText(c.mapCode).width + 20
    ctx.fillStyle = '#000'
    ctx.fillRect(sx - 6, sy - 40, w, 32)
    ctx.fillStyle = accent
    ctx.fillText(c.mapCode, sx + 4, sy - 17)
  }

  ctx.fillStyle = '#e8eef3'
  ctx.font = '800 30px "Saira Condensed"'
  ctx.fillText('JARKOMAN', 56, 72)
  ctx.fillStyle = '#82d8ff'
  ctx.font = '700 22px Rajdhani'
  spaced(ctx, c.kicker.toUpperCase(), 56, 150, 2)
  const t = fit(ctx, c.title.toUpperCase(), (px) => `800 ${px}px "Saira Condensed"`, 520, 118, 60, 3)
  const tg = ctx.createLinearGradient(0, 160, 0, 160 + t.px * t.lines.length)
  tg.addColorStop(0, '#ffffff')
  tg.addColorStop(1, '#b9cad9')
  ctx.fillStyle = tg
  ctx.font = `800 ${t.px}px "Saira Condensed"`
  t.lines.forEach((l, i) => ctx.fillText(l, 52, 160 + t.px * 0.88 * (i + 1)))
  let y = 160 + t.px * 0.88 * t.lines.length + 44
  ctx.fillStyle = '#cbd6e0'
  const cpx = fitAll(ctx, c.lines.slice(0, 2), (px) => `600 ${px}px Rajdhani`, 520, 26, 16)
  ctx.font = `600 ${cpx}px Rajdhani`
  for (const l of c.lines.slice(0, 2)) {
    ctx.fillText(l, 56, y)
    y += cpx + 6
  }
  // Tombol aksen bergradasi.
  const bx = 56
  const by = 522
  const bw = 250
  const bh = 62
  const bgBtn = ctx.createLinearGradient(0, by, 0, by + bh)
  bgBtn.addColorStop(0, ct ? '#d4e9fc' : '#f8dd92')
  bgBtn.addColorStop(0.46, accent)
  bgBtn.addColorStop(1, ct ? '#5d9ad6' : '#c8932e')
  ctx.fillStyle = bgBtn
  ctx.fillRect(bx, by, bw, bh)
  ctx.fillStyle = ct ? '#07111f' : '#1a1206'
  ctx.font = '700 28px Rajdhani'
  spaced(ctx, c.cta.toUpperCase(), bx + bw / 2, by + 41, 2, 'center')
  ctx.fillStyle = '#cbd6e0'
  ctx.font = '600 20px Rajdhani'
  ctx.fillText(fit(ctx, c.ctaNote, (px) => `600 ${px}px Rajdhani`, 280, 20, 15, 1).lines[0], bx + bw + 20, by + 39)
}

function drawMlbb(ctx: CanvasRenderingContext2D, c: OgContent, art: HTMLImageElement) {
  const red = c.variant === 'red'
  const bg = ctx.createLinearGradient(0, 0, 0, OG_H)
  bg.addColorStop(0, red ? '#350c27' : '#0f1747')
  bg.addColorStop(1, red ? '#12030c' : '#04061a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, OG_W, OG_H)
  // Poster sebagai banner yang memudar ke langit malam. Warna ujung pudar = warna latar di baris itu, jadi tidak ada
  // garis sambungan.
  const top = red ? [53, 12, 39] : [15, 23, 71]
  const bottom = red ? [18, 3, 12] : [4, 6, 26]
  const bgAt = (y: number, a: number) => {
    const t = y / OG_H
    const [r, g, b] = top.map((v, i) => Math.round(v + (bottom[i] - v) * t))
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }
  cover(ctx, art, 0, 0, OG_W, 400, 0.5, 0.05)
  const fade = ctx.createLinearGradient(0, 140, 0, 400)
  fade.addColorStop(0, bgAt(140, 0))
  fade.addColorStop(0.55, bgAt(283, 0.75))
  fade.addColorStop(1, bgAt(400, 1))
  ctx.fillStyle = fade
  ctx.fillRect(0, 140, OG_W, 261)
  const nebula = ctx.createRadialGradient(900, 470, 20, 900, 470, 420)
  nebula.addColorStop(0, red ? 'rgba(176,48,110,0.35)' : 'rgba(107,63,214,0.4)')
  nebula.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = nebula
  ctx.fillRect(0, 0, OG_W, OG_H)
  const dusk = ctx.createRadialGradient(600, 360, 10, 600, 360, 420)
  dusk.addColorStop(0, 'rgba(255,178,138,0.25)')
  dusk.addColorStop(1, 'rgba(255,178,138,0)')
  ctx.fillStyle = dusk
  ctx.fillRect(0, 0, OG_W, OG_H)

  ctx.textAlign = 'center'
  const t = fit(ctx, c.title.toUpperCase(), (px) => `900 ${px}px Rubik`, 1040, 92, 50, 1)
  ctx.font = `900 ${t.px}px Rubik`
  const ty = 430
  const gold = ctx.createLinearGradient(0, ty - t.px * 0.8, 0, ty + 6)
  gold.addColorStop(0, '#fffdf0')
  gold.addColorStop(0.3, '#ffe9a3')
  gold.addColorStop(0.47, '#fff4cf')
  gold.addColorStop(0.53, '#ffc94a')
  gold.addColorStop(0.78, '#e8932a')
  gold.addColorStop(1, '#a8560f')
  ctx.lineJoin = 'round'
  ctx.lineWidth = 10
  ctx.strokeStyle = '#140b36'
  ctx.strokeText(t.lines[0], OG_W / 2, ty)
  ctx.fillStyle = '#5a2c06'
  ctx.fillText(t.lines[0], OG_W / 2, ty + 5)
  ctx.fillStyle = gold
  ctx.fillText(t.lines[0], OG_W / 2, ty)
  ctx.fillStyle = '#d3def7'
  ctx.font = '600 26px Rubik'
  ctx.fillText(fit(ctx, c.lines.join('   ·   '), (px) => `600 ${px}px Rubik`, 1040, 26, 18, 1).lines[0], OG_W / 2, 482)
  // Tombol emas dan keterangan.
  const bw = 260
  const bh = 62
  const bx = OG_W / 2 - bw / 2
  const by = 524
  const btn = ctx.createLinearGradient(0, by, 0, by + bh)
  btn.addColorStop(0, '#fffdf0')
  btn.addColorStop(0.47, '#fff4cf')
  btn.addColorStop(0.53, '#ffc94a')
  btn.addColorStop(1, '#b8630f')
  ctx.fillStyle = btn
  ctx.beginPath()
  ctx.roundRect(bx, by, bw, bh, 10)
  ctx.fill()
  ctx.fillStyle = '#2b1700'
  ctx.font = '800 26px Rubik'
  spaced(ctx, c.cta.toUpperCase(), OG_W / 2, by + 41, 2, 'center')
  ctx.textAlign = 'left'
  ctx.font = '900 22px Rubik'
  ctx.fillStyle = '#ffd66b'
  ctx.fillText('JARKOMAN', 40, 598)
}

function drawRepo(ctx: CanvasRenderingContext2D, c: OgContent, art: HTMLImageElement) {
  const light = c.variant === 'lampu'
  ctx.fillStyle = light ? '#f3ecdc' : '#0b0a0c'
  ctx.fillRect(0, 0, OG_W, OG_H)
  if (!light) {
    const lamp = ctx.createRadialGradient(360, 260, 10, 360, 260, 520)
    lamp.addColorStop(0, 'rgba(245,184,46,0.14)')
    lamp.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = lamp
    ctx.fillRect(0, 0, OG_W, OG_H)
  }
  // Monitor CRT truk berisi key art, dengan garis pindai.
  const mx = 60
  const my = 70
  const mw = 600
  const mh = 330
  ctx.fillStyle = light ? '#1c1a17' : '#23201c'
  ctx.beginPath()
  ctx.roundRect(mx - 18, my - 18, mw + 36, mh + 36, 22)
  ctx.fill()
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(mx, my, mw, mh, 14)
  ctx.clip()
  cover(ctx, art, mx, my, mw, mh, 0.22, 0.5)
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  for (let y = my; y < my + mh; y += 4) ctx.fillRect(mx, y, mw, 1.5)
  ctx.restore()

  const hazard = '#f5b82e'
  ctx.fillStyle = light ? '#111' : '#e9e2d0'
  ctx.font = '600 44px Teko'
  ctx.fillText('J.A.R.K.O.M.A.N.', 720, 104)
  const t = fit(ctx, c.title.toUpperCase(), (px) => `600 ${px}px Teko`, 430, 108, 56, 3)
  ctx.fillStyle = light ? '#8a5a00' : hazard
  ctx.font = `600 ${t.px}px Teko`
  t.lines.forEach((l, i) => ctx.fillText(l, 718, 150 + t.px * 0.82 * (i + 1)))
  let y = 150 + t.px * 0.82 * t.lines.length + 40
  ctx.fillStyle = light ? '#2c6b1f' : '#7cff6b'
  const rpx = fitAll(
    ctx,
    c.lines.slice(0, 2).map((l) => `> ${l}`),
    (px) => `400 ${px}px VT323`,
    440,
    30,
    18,
  )
  ctx.font = `400 ${rpx}px VT323`
  for (const l of c.lines.slice(0, 2)) {
    ctx.fillText(`> ${l}`, 720, y)
    y += rpx + 2
  }
  // Pita hazard dengan tombol NAIK TRUK.
  const band = 470
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, band, OG_W, 22)
  ctx.clip()
  for (let x = -40; x < OG_W + 40; x += 44) {
    ctx.fillStyle = hazard
    ctx.beginPath()
    ctx.moveTo(x, band)
    ctx.lineTo(x + 22, band)
    ctx.lineTo(x + 44, band + 22)
    ctx.lineTo(x + 22, band + 22)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
  const bx = 60
  const by = 526
  const bw = 250
  const bh = 64
  ctx.fillStyle = hazard
  ctx.fillRect(bx, by, bw, bh)
  ctx.fillStyle = '#120d02'
  ctx.font = '600 44px Teko'
  ctx.textAlign = 'center'
  ctx.fillText(c.cta.toUpperCase(), bx + bw / 2, by + 50)
  ctx.textAlign = 'left'
  ctx.fillStyle = light ? '#2c2a26' : '#e9e2d0'
  ctx.font = '400 28px VT323'
  ctx.fillText(fit(ctx, c.ctaNote, (px) => `400 ${px}px VT323`, 560, 28, 20, 1).lines[0], bx + bw + 24, by + 42)
}

const DRAW: Record<GameId, (ctx: CanvasRenderingContext2D, c: OgContent, art: HTMLImageElement) => void> = {
  valorant: drawValorant,
  cs2: drawCs2,
  mlbb: drawMlbb,
  repo: drawRepo,
}

/** Gambar kartu OG ke canvas baru. */
export async function drawOg(c: OgContent): Promise<HTMLCanvasElement> {
  await ensureFonts(c.game)
  const art = await artFor(c)
  const canvas = document.createElement('canvas')
  canvas.width = OG_W
  canvas.height = OG_H
  const ctx = canvas.getContext('2d')!
  DRAW[c.game](ctx, c, art)
  return canvas
}

export function toJpeg(canvas: HTMLCanvasElement, quality = 0.86): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('gagal membuat gambar'))), 'image/jpeg', quality))
}
