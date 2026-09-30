import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

describe('Content-Security-Policy', () => {
  it('setiap script inline di index.html diizinkan lewat hash di netlify.toml', () => {
    const html = read('index.html')
    const toml = read('netlify.toml')
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])
    expect(inline.length).toBeGreaterThan(0)
    for (const body of inline) {
      const hash = `sha256-${createHash('sha256').update(body).digest('base64')}`
      expect(toml).toContain(`'${hash}'`)
    }
  })

  it('halaman admin tidak punya script inline', () => {
    const html = read('admin/index.html')
    expect([...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/g)]).toHaveLength(0)
  })
})
