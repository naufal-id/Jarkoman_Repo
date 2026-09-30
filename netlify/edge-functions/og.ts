// Edge function ini hanya jalan untuk bot pembuat preview link (WhatsApp, Telegram, Discord, dll).
// Pengunjung biasa langsung diteruskan tanpa diproses. Tujuannya: saat link jarkoman dibagikan di grup,
// judul, deskripsi, dan gambar preview sesuai game yang sedang aktif.
// File ini sengaja mandiri (tanpa impor ke src/) karena edge function berjalan di Deno.
import type { Config, Context } from '@netlify/edge-functions'

const BOTS =
  /(whatsapp|facebookexternalhit|facebot|meta-externalagent|twitterbot|telegrambot|discordbot|slackbot|linkedinbot|skypeuripreview|pinterest|redditbot|embedly|vkshare|applebot|googlebot|bingbot|line\/|kakaotalk|snapchat|mastodon|signal|zalo|iframely)/i

const GAME_NAMES: Record<string, string> = { valorant: 'VALORANT', cs2: 'CS2', mlbb: 'MLBB', repo: 'R.E.P.O.' }
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

interface Item {
  id: string
  game: string
  headline: string
  subline: string
  mode: string
  map: string
  date: string
  time: string
  tz: string
  slots: number
  status: string
  autoJoin?: boolean
  players: { status: string }[]
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function formatDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return ''
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return `${DAYS[d.getUTCDay()]}, ${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`
}

function describe(item: Item): string {
  const filled = item.players.filter((p) => p.status === 'in').length
  const parts = [
    `${formatDate(item.date)} ${item.time.replace(':', '.')} ${item.tz}`.trim(),
    [item.mode, item.map].filter(Boolean).join(' di '),
    item.status === 'cancelled' ? 'DIBATALKAN' : filled >= item.slots ? `Slot penuh (${filled}/${item.slots}), cadangan boleh` : `${filled}/${item.slots} slot terisi`,
  ].filter(Boolean)
  const fallback = item.autoJoin === false ? 'Konfirmasi lewat WhatsApp.' : 'Isi nama, langsung masuk skuad.'
  return `${parts.join(' · ')}. ${item.subline || fallback}`.slice(0, 280)
}

function metaBlock(item: Item, origin: string, pageUrl: string, custom: string | null): string {
  const game = GAME_NAMES[item.game] ?? 'Mabar'
  const title = `${game}: ${item.headline}`
  const desc = describe(item)
  // Gambar khusus jarkoman ini (judul dan jadwalnya tertulis di gambar) kalau dashboard sudah membuatnya.
  const image = custom ?? `${origin}/og/${GAME_NAMES[item.game] ? item.game : 'valorant'}.jpg`
  return [
    `<title>${escapeAttr(title)} | Jarkoman</title>`,
    `<meta name="description" content="${escapeAttr(desc)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Jarkoman">`,
    `<meta property="og:url" content="${escapeAttr(pageUrl)}">`,
    `<meta property="og:title" content="${escapeAttr(title)}">`,
    `<meta property="og:description" content="${escapeAttr(desc)}">`,
    `<meta property="og:image" content="${escapeAttr(image)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeAttr(title)}">`,
    `<meta name="twitter:description" content="${escapeAttr(desc)}">`,
    `<meta name="twitter:image" content="${escapeAttr(image)}">`,
  ].join('\n    ')
}

export default async (req: Request, context: Context) => {
  const ua = req.headers.get('user-agent') ?? ''
  if (!BOTS.test(ua)) return

  const url = new URL(req.url)
  const res = await context.next()
  if (!(res.headers.get('content-type') ?? '').includes('text/html')) return res

  const html = await res.text()
  const headers = new Headers(res.headers)
  headers.delete('content-length')
  try {
    const stateRes = await fetch(new URL('/api/state', url.origin), { signal: AbortSignal.timeout(2500) })
    const body = (await stateRes.json()) as { state?: { featuredId: string; items: Item[] } | null }
    const state = body.state
    const wanted = url.searchParams.get('id')
    const item = state?.items.find((i) => i.id === wanted) ?? state?.items.find((i) => i.id === state.featuredId) ?? state?.items[0]
    if (item) {
      let custom: string | null = null
      try {
        const meta = await fetch(new URL(`/api/og?id=${encodeURIComponent(item.id)}&meta=1`, url.origin), { signal: AbortSignal.timeout(1500) })
        const sig = ((await meta.json()) as { sig?: string | null }).sig
        if (meta.ok && sig) custom = `${url.origin}/api/og?id=${encodeURIComponent(item.id)}&v=${encodeURIComponent(sig)}`
      } catch {
        // Tanpa gambar khusus: pakai gambar per game.
      }
      const replaced = html.replace(/<!--og-->[\s\S]*?<!--\/og-->/, `<!--og-->\n    ${metaBlock(item, url.origin, url.toString(), custom)}\n    <!--/og-->`)
      return new Response(replaced, { status: res.status, headers })
    }
  } catch (err) {
    console.warn('[og] fallback ke meta default', err)
  }
  return new Response(html, { status: res.status, headers })
}

export const config: Config = {
  path: '/',
}
