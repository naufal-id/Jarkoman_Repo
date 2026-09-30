import { expect, test } from '@playwright/test'
import { publishAll, skipIntros } from './helpers'
import type { GameId, Jarkoman } from '../../src/shared/types'

let items: Record<GameId, Jarkoman>

test.beforeAll(async ({ request }) => {
  items = await publishAll(request)
})

test('LOCK IN langsung masuk skuad jarkoman itu saja, lalu batal ikut', async ({ page }) => {
  await skipIntros(page)
  await page.goto(`/?id=${items.valorant.id}`)
  const join = page.locator('#join')
  await join.locator('input.jf__input').first().fill('Raka E2E')
  await join.locator('button[type=submit]').click()

  await expect(join.locator('.jf__done-name')).toHaveText('Raka E2E')
  await expect(page.locator('main')).toContainText('Raka E2E')

  // Jarkoman game lain tidak ikut terisi dan formnya kosong.
  await page.goto(`/?id=${items.cs2.id}`)
  await expect(page.locator('#join input.jf__input').first()).toHaveValue('')
  await expect(page.locator('main')).not.toContainText('Raka E2E')

  // Kembali dan batalkan dari perangkat yang sama.
  await page.goto(`/?id=${items.valorant.id}`)
  await page.getByRole('button', { name: 'Batal ikut' }).click()
  await page.getByRole('button', { name: 'Ya, batal ikut' }).click()
  await expect(page.locator('#join button[type=submit]')).toBeVisible()
  await expect(page.locator('main')).not.toContainText('Raka E2E')
})

test('nama kembar ditolak dengan pesan yang jelas', async ({ page, browser }) => {
  await skipIntros(page)
  await page.goto(`/?id=${items.mlbb.id}`)
  await page.locator('#join input.jf__input').first().fill('Sari E2E')
  await page.locator('#join button[type=submit]').click()
  await expect(page.locator('#join .jf__done-name')).toHaveText('Sari E2E')

  const other = await browser.newContext({ reducedMotion: 'reduce' })
  const p2 = await other.newPage()
  await skipIntros(p2)
  await p2.goto(`/?id=${items.mlbb.id}`)
  await p2.locator('#join input.jf__input').first().fill('sari e2e')
  await p2.locator('#join button[type=submit]').click()
  await expect(p2.locator('#join .jf__error')).toBeVisible()
  await other.close()
})

test('ubah role setelah ikut, lalu naik dari cadangan saat ada yang batal', async ({ page, request }) => {
  const j = items.cs2
  // Isi skuad sampai penuh lewat API supaya perangkat ini masuk cadangan.
  const keys: { player: string; key: string }[] = []
  for (let i = 0; i < j.slots; i++) {
    const res = await request.post('/api/join', { data: { id: j.id, name: `Isi ${i + 1}` } })
    const body = (await res.json()) as { player: { id: string }; key: string }
    keys.push({ player: body.player.id, key: body.key })
  }

  await skipIntros(page)
  await page.goto(`/?id=${j.id}`)
  await page.locator('#join input.jf__input').first().fill('Cadangan E2E')
  await page.locator('#join button[type=submit]').click()
  await expect(page.locator('#join .jf__done-kicker')).toHaveText('Cadangan ke-1')

  // Ubah role tanpa kehilangan posisi.
  await page.getByRole('button', { name: /^Ubah role/ }).click()
  await page.locator('#join .cs-chip', { hasText: 'IGL' }).click()
  await page.getByRole('button', { name: 'Simpan perubahan' }).click()
  await expect(page.locator('#join .jf__done-text')).toContainText('IGL')
  await expect(page.locator('#join .jf__done-kicker')).toHaveText('Cadangan ke-1')

  // Salah satu pemain di skuad batal: cadangan pertama naik. Muat ulang halaman untuk melihat pemberitahuannya.
  await request.delete('/api/join', { data: { id: j.id, ...keys[0] } })
  await page.reload()
  await expect(page.locator('#join .jf__done-kicker')).toHaveText(`Naik dari cadangan · Slot ${j.slots} terkunci`)
})
