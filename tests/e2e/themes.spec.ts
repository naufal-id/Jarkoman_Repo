import { expect, test } from '@playwright/test'
import { GAMES, overflowX, publishAll, skipIntros, VARIANTS } from './helpers'
import type { GameId, Jarkoman } from '../../src/shared/types'

let items: Record<GameId, Jarkoman>

test.beforeAll(async ({ request }) => {
  items = await publishAll(request)
})

for (const game of GAMES) {
  for (const variant of VARIANTS[game]) {
    for (const width of [320, 1440]) {
      test(`${game}/${variant} @${width}px: tampil tanpa error dan tanpa scroll ke samping`, async ({ page }) => {
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(e.message))
        page.on('console', (m) => {
          // Gambar dari valorant-api/Steam bisa gagal dimuat di CI tanpa internet; itu bukan error halaman.
          if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text())
        })
        await page.setViewportSize({ width, height: 900 })
        await skipIntros(page)
        await page.goto('/?preview=1')
        const item = { ...items[game], variant }
        const others = GAMES.filter((g) => g !== game).map((g) => items[g])
        await page.evaluate((payload) => window.postMessage({ type: 'jk:preview', ...payload }, location.origin), { item, others })
        await expect(page.locator('#join')).toBeVisible()
        await page.waitForTimeout(600)
        expect(await overflowX(page)).toBe(0)
        expect(errors).toEqual([])
      })
    }
  }
}
