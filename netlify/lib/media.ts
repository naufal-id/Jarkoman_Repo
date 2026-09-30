import { GAMES } from '../../src/shared/games'
import type { AgentMedia, GameId, MapMarker, MapMedia, MediaItem, MediaPayload } from '../../src/shared/types'

type Fetcher = typeof fetch

const TIMEOUT_MS = 7000
export const STEAM_APPS: Partial<Record<GameId, number>> = { cs2: 730, repo: 3241660 }
export const MLBB_APP_STORE_ID = 1160056295

async function getJson(fetcher: Fetcher, url: string): Promise<unknown> {
  const res = await fetcher(url, {
    headers: { accept: 'application/json', 'user-agent': 'Jarkoman/1.0 (+netlify function)' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  return res.json()
}

const isHttps = (v: unknown): v is string => typeof v === 'string' && v.startsWith('https://')

/** "ff4655ff" (RRGGBBAA dari valorant-api) menjadi "#ff4655" */
export function hexFromRgba(v: unknown): string | null {
  if (typeof v !== 'string' || !/^[0-9a-f]{6,8}$/i.test(v)) return null
  return `#${v.slice(0, 6).toLowerCase()}`
}

interface ValorantCallout {
  regionName?: string
  superRegionName?: string
  location?: { x?: number; y?: number }
}

interface ValorantMap {
  displayName?: string
  splash?: string
  listViewIcon?: string
  listViewIconTall?: string
  displayIcon?: string | null
  coordinates?: string | null
  tacticalDescription?: string | null
  xMultiplier?: number
  yMultiplier?: number
  xScalarToAdd?: number
  yScalarToAdd?: number
  callouts?: ValorantCallout[] | null
}

const SPAWN_LABEL: Record<string, string> = { 'Attacker Side': 'ATK', 'Defender Side': 'DEF' }

/**
 * Penanda site dan spawn di minimap. Rumus valorant-api: sumbu dunia tertukar,
 * x minimap = y dunia * xMultiplier + xScalarToAdd, y minimap = x dunia * yMultiplier + yScalarToAdd (hasil 0 sampai 1).
 */
export function mapMarkers(m: ValorantMap): MapMarker[] {
  const { xMultiplier: xm, yMultiplier: ym, xScalarToAdd: xa, yScalarToAdd: ya } = m
  if (![xm, ym, xa, ya].every((n) => typeof n === 'number' && Number.isFinite(n))) return []
  const out: MapMarker[] = []
  for (const c of m.callouts ?? []) {
    const wx = c.location?.x
    const wy = c.location?.y
    if (typeof wx !== 'number' || typeof wy !== 'number') continue
    const region = (c.regionName ?? '').trim()
    const zone = (c.superRegionName ?? '').trim()
    let marker: Omit<MapMarker, 'x' | 'y'> | null = null
    if (region === 'Site' && /^[A-C]$/.test(zone)) marker = { kind: 'site', label: zone }
    else if (region === 'Spawn' && SPAWN_LABEL[zone]) marker = { kind: 'spawn', label: SPAWN_LABEL[zone] }
    if (!marker || out.some((o) => o.kind === marker.kind && o.label === marker.label)) continue
    const x = wy * xm! + xa!
    const y = wx * ym! + ya!
    if (x < 0 || x > 1 || y < 0 || y > 1) continue
    out.push({ ...marker, x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 })
  }
  return out
}

interface ValorantAgent {
  displayName?: string
  fullPortrait?: string | null
  fullPortraitV2?: string | null
  displayIcon?: string | null
  backgroundGradientColors?: string[]
  role?: { displayName?: string } | null
  isPlayableCharacter?: boolean
}

export async function valorantMedia(fetcher: Fetcher): Promise<MediaPayload> {
  const wanted = new Set(GAMES.valorant.maps.map((m) => m.toLowerCase()))
  const [mapsRes, agentsRes] = await Promise.all([
    getJson(fetcher, 'https://valorant-api.com/v1/maps'),
    getJson(fetcher, 'https://valorant-api.com/v1/agents?isPlayableCharacter=true'),
  ])
  const maps: Record<string, string> = {}
  const mapInfo: Record<string, MapMedia> = {}
  const gallery: MediaItem[] = []
  for (const m of (mapsRes as { data?: ValorantMap[] }).data ?? []) {
    const name = (m.displayName ?? '').trim()
    if (!wanted.has(name.toLowerCase()) || !isHttps(m.splash)) continue
    if (maps[name.toLowerCase()]) continue
    maps[name.toLowerCase()] = m.splash
    mapInfo[name.toLowerCase()] = {
      splash: m.splash,
      minimap: isHttps(m.displayIcon) ? m.displayIcon : undefined,
      coordinates: typeof m.coordinates === 'string' ? m.coordinates.slice(0, 60) : undefined,
      sites: typeof m.tacticalDescription === 'string' ? m.tacticalDescription.slice(0, 30) : undefined,
      markers: mapMarkers(m),
    }
    gallery.push({ url: m.splash, thumb: isHttps(m.listViewIconTall) ? m.listViewIconTall : m.splash, label: name, kind: 'map' })
  }
  const agents: Record<string, AgentMedia> = {}
  for (const a of (agentsRes as { data?: ValorantAgent[] }).data ?? []) {
    const name = (a.displayName ?? '').trim()
    if (!name || a.isPlayableCharacter === false) continue
    const portrait = a.fullPortraitV2 || a.fullPortrait
    agents[name.toLowerCase()] = {
      portrait: isHttps(portrait) ? portrait : undefined,
      icon: isHttps(a.displayIcon) ? a.displayIcon : undefined,
      colors: (a.backgroundGradientColors ?? []).map(hexFromRgba).filter((c): c is string => c !== null),
      role: a.role?.displayName,
    }
  }
  gallery.sort((x, y) => x.label.localeCompare(y.label))
  return {
    game: 'valorant',
    source: 'valorant-api.com',
    sourceUrl: 'https://valorant-api.com',
    gallery,
    maps,
    mapInfo,
    agents,
  }
}

interface SteamData {
  name?: string
  header_image?: string
  background_raw?: string
  background?: string
  screenshots?: { path_full?: string; path_thumbnail?: string }[]
}

export async function steamMedia(fetcher: Fetcher, game: GameId, appId: number): Promise<MediaPayload> {
  const raw = (await getJson(fetcher, `https://store.steampowered.com/api/appdetails?appids=${appId}&l=english`)) as Record<string, { success?: boolean; data?: SteamData }>
  const entry = raw?.[String(appId)]
  if (!entry?.success || !entry.data) throw new Error(`steam ${appId} tidak tersedia`)
  const data = entry.data
  const shots: MediaItem[] = (data.screenshots ?? [])
    .filter((s) => isHttps(s.path_full))
    .slice(0, 12)
    .map((s, i) => ({ url: s.path_full!, thumb: isHttps(s.path_thumbnail) ? s.path_thumbnail : s.path_full, label: `Screenshot ${i + 1}`, kind: 'shot' }))
  const art: MediaItem[] = []
  const bg = isHttps(data.background_raw) ? data.background_raw : isHttps(data.background) ? data.background : undefined
  if (bg) art.push({ url: bg, label: 'Background Steam', kind: 'art' })
  if (isHttps(data.header_image)) art.push({ url: data.header_image, label: 'Header Steam', kind: 'art' })
  return {
    game,
    source: 'Steam',
    sourceUrl: `https://store.steampowered.com/app/${appId}/`,
    hero: shots[0]?.url ?? bg,
    gallery: [...shots, ...art],
  }
}

/** URL gambar mzstatic berakhiran ukuran, misalnya ".../392x696bb.jpg". Ganti ke ukuran besar. */
export function upscaleAppStore(url: string, size = '1600x0w'): string {
  return url.replace(/\/\d+x\d+[a-z]*\.(jpg|jpeg|png|webp)$/i, `/${size}.jpg`)
}

export async function mlbbMedia(fetcher: Fetcher): Promise<MediaPayload> {
  const raw = (await getJson(fetcher, `https://itunes.apple.com/lookup?id=${MLBB_APP_STORE_ID}&country=id`)) as {
    results?: { screenshotUrls?: string[]; ipadScreenshotUrls?: string[]; artworkUrl512?: string }[]
  }
  const app = raw?.results?.[0]
  if (!app) throw new Error('app store lookup kosong')
  const urls = [...(app.screenshotUrls ?? []), ...(app.ipadScreenshotUrls ?? [])].filter(isHttps)
  const unique = [...new Set(urls)].slice(0, 12)
  const gallery: MediaItem[] = unique.map((u, i) => ({ url: upscaleAppStore(u), thumb: u, label: `Screenshot ${i + 1}`, kind: 'shot' }))
  return {
    game: 'mlbb',
    source: 'App Store',
    sourceUrl: `https://apps.apple.com/id/app/id${MLBB_APP_STORE_ID}`,
    hero: gallery[0]?.url,
    gallery,
  }
}

export async function loadMedia(game: GameId, fetcher: Fetcher = fetch): Promise<MediaPayload> {
  if (game === 'valorant') return valorantMedia(fetcher)
  if (game === 'mlbb') return mlbbMedia(fetcher)
  const appId = STEAM_APPS[game]
  if (!appId) throw new Error(`game ${game} tidak punya sumber media`)
  return steamMedia(fetcher, game, appId)
}
