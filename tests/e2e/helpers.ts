import type { APIRequestContext, Page } from '@playwright/test'
import { createJarkoman } from '../../src/shared/defaults'
import type { GameId, Jarkoman, SiteState } from '../../src/shared/types'

export const GAMES: GameId[] = ['valorant', 'cs2', 'mlbb', 'repo']
export const VARIANTS: Record<GameId, string[]> = { valorant: ['ink', 'bone'], cs2: ['t', 'ct'], mlbb: ['blue', 'red'], repo: ['senter', 'lampu'] }

/** Satu jarkoman per game, minggu depan, langsung dipublikasikan lewat API admin. */
export async function publishAll(request: APIRequestContext): Promise<Record<GameId, Jarkoman>> {
  const login = await request.post('/api/login', { data: { password: 'admin' } })
  const { token } = (await login.json()) as { token: string }
  const date = new Date(Date.now() + 5 * 24 * 3600_000).toISOString().slice(0, 10)
  const items = GAMES.map((g) => ({ ...createJarkoman(g), date }))
  const current = ((await (await request.get('/api/state')).json()) as { state: SiteState | null }).state
  const state: SiteState = { version: 1, featuredId: items[0].id, items, updatedAt: 0, joinSeq: 0, gone: [] }
  const res = await request.put('/api/state', {
    headers: { authorization: `Bearer ${token}` },
    data: { state, baseUpdatedAt: current?.updatedAt ?? 0, force: true },
  })
  if (!res.ok()) throw new Error(`publish gagal: ${res.status()} ${await res.text()}`)
  return Object.fromEntries(items.map((i) => [i.game, i])) as Record<GameId, Jarkoman>
}

/** Lewati intro per tema supaya test langsung ke halaman. */
export async function skipIntros(page: Page) {
  await page.addInitScript((games) => games.forEach((g) => sessionStorage.setItem(`jk:intro:${g}`, '1')), GAMES)
}

/** Lebar konten yang meluap ke kanan (0 = tidak ada scroll ke samping). */
export async function overflowX(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}
