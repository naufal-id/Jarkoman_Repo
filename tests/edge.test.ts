import { afterEach, describe, expect, it, vi } from 'vitest'
import og from '../netlify/edge-functions/og'
import { blankPlayer, createJarkoman } from '../src/shared/defaults'

const HTML = `<html><head>
    <!--og-->
    <title>Jarkoman | Ajakan mabar</title>
    <meta property="og:image" content="/og/valorant.jpg" />
    <!--/og-->
  </head><body></body></html>`

function context() {
  return {
    next: async () => new Response(HTML, { headers: { 'content-type': 'text/html; charset=utf-8', 'content-length': String(HTML.length) } }),
  } as unknown as Parameters<typeof og>[1]
}

afterEach(() => vi.unstubAllGlobals())

describe('edge function og', () => {
  it('tidak memproses pengunjung biasa', async () => {
    const res = await og(new Request('https://mabar.test/', { headers: { 'user-agent': 'Mozilla/5.0 Chrome/140' } }), context())
    expect(res).toBeUndefined()
  })

  it('mengganti meta untuk bot WhatsApp sesuai jarkoman yang diminta', async () => {
    const item = createJarkoman('mlbb')
    item.headline = 'Push "Rank" <Malam>'
    item.players = [blankPlayer({ id: 'p1', name: 'A', role: '', pick: '', status: 'in' })]
    const other = createJarkoman('cs2')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ state: { version: 1, featuredId: other.id, items: [other, item], updatedAt: 1 } })),
    )
    const res = (await og(new Request(`https://mabar.test/?id=${item.id}`, { headers: { 'user-agent': 'WhatsApp/2.24.1 A' } }), context()))!
    const html = await res.text()
    expect(html).toContain('<title>MLBB: Push &quot;Rank&quot; &lt;Malam&gt; | Jarkoman</title>')
    expect(html).toContain('content="https://mabar.test/og/mlbb.jpg"')
    expect(html).toContain('1/5 slot terisi')
    expect(html).not.toContain('/og/valorant.jpg')
    expect(res.headers.get('content-length')).toBeNull()
  })

  it('tetap mengembalikan HTML asli kalau API gagal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('down')
      }),
    )
    const res = (await og(new Request('https://mabar.test/', { headers: { 'user-agent': 'facebookexternalhit/1.1' } }), context()))!
    expect(await res.text()).toContain('/og/valorant.jpg')
  })

  it('memakai gambar khusus jarkoman kalau dashboard sudah membuatnya', async () => {
    const item = createJarkoman('cs2')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | string) => {
        const url = String(input)
        if (url.includes('/api/og')) return Response.json({ sig: 'abc123' })
        return Response.json({ state: { version: 1, featuredId: item.id, items: [item], updatedAt: 1 } })
      }),
    )
    const res = (await og(new Request(`https://mabar.test/?id=${item.id}`, { headers: { 'user-agent': 'WhatsApp/2.24.1 A' } }), context()))!
    const html = await res.text()
    expect(html).toContain(`content="https://mabar.test/api/og?id=${item.id}&amp;v=abc123"`)
    expect(html).not.toContain('/og/cs2.jpg')
  })
})
