// Membuat ulang gambar preview link bawaan per game (public/og/*.jpg) dari modul canvas yang sama dengan dashboard.
// Pakai: jalankan `npm run dev`, lalu `node tools/render-og.mjs` (butuh Playwright + Chromium).
import { writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(`${BASE}/tools/og.html`)
await page.waitForFunction(() => typeof window.renderOg === 'function')
for (const game of ['valorant', 'cs2', 'mlbb', 'repo']) {
  const url = await page.evaluate((g) => window.renderOg(g), game)
  const file = new URL(`../public/og/${game}.jpg`, import.meta.url)
  writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'))
  console.log('ditulis', file.pathname)
}
await browser.close()
