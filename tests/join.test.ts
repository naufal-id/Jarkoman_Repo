import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import joinHandler from '../netlify/functions/join.mts'
import stateHandler from '../netlify/functions/state.mts'
import { issueToken, joinKey, legacyJoinSecret, verifyJoinKey } from '../netlify/lib/auth'
import { joinSecrets } from '../netlify/lib/join-secret'
import { memoryAudioStore, memoryStore, setAudioStoreForTests, setStoreForTests, updateJSON, type KV } from '../netlify/lib/store'
import { blankPlayer, createJarkoman } from '../src/shared/defaults'
import { addWebPlayer, applyWebChanges, joinCloseLabel, joinClosed, JoinError, neededRoles, removeWebPlayer, updateWebPlayer } from '../src/shared/joins'
import { buildBroadcast } from '../src/shared/wa'
import { cleanState } from '../src/shared/sanitize'
import { KEYS } from '../src/shared/storage'
import type { Jarkoman, SiteState } from '../src/shared/types'

const req = (path: string, init: RequestInit = {}) => new Request(`http://localhost${path}`, init)
const auth = () => ({ authorization: `Bearer ${issueToken().token}` })

let kv: KV

beforeEach(() => {
  process.env.ADMIN_PASSWORD = 'rahasia-mabar'
  delete process.env.JARKOMAN_SECRET
  kv = memoryStore()
  setStoreForTests(kv)
  setAudioStoreForTests(memoryAudioStore())
})

afterEach(() => {
  setStoreForTests(null)
  setAudioStoreForTests(null)
})

/** Jarkoman minggu depan supaya status tidak "selesai" saat test dijalankan. */
function upcoming(game: Jarkoman['game']): Jarkoman {
  const j = createJarkoman(game)
  j.date = new Date(Date.now() + 5 * 24 * 3600_000).toISOString().slice(0, 10)
  return j
}

function stateOf(...items: Jarkoman[]): SiteState {
  return { version: 1, featuredId: items[0].id, items, updatedAt: 0, joinSeq: 0, gone: [] }
}

async function publish(state: SiteState, base = 0) {
  const res = await stateHandler(req('/api/state', { method: 'PUT', headers: auth(), body: JSON.stringify({ state, baseUpdatedAt: base }) }))
  return { res, body: (await res.json()) as { state: SiteState } }
}

async function join(body: Record<string, unknown>) {
  const res = await joinHandler(req('/api/join', { method: 'POST', body: JSON.stringify(body) }))
  return { res, body: (await res.json()) as { item: Jarkoman; player: { id: string; name: string }; key: string; slot: number | null; code?: string } }
}

async function server(): Promise<SiteState> {
  return ((await (await stateHandler(req('/api/state'))).json()) as { state: SiteState }).state
}

/** Bacaan dashboard admin (dengan token), termasuk catatan pemain. */
async function adminServer(): Promise<SiteState> {
  return ((await (await stateHandler(req('/api/state', { headers: auth() }))).json()) as { state: SiteState }).state
}

describe('pendaftaran langsung (LOCK IN)', () => {
  it('pemain masuk skuad jarkoman yang dipilih saja, bukan jarkoman lain', async () => {
    const val = upcoming('valorant')
    const cs = upcoming('cs2')
    await publish(stateOf(val, cs))

    const { res, body } = await join({ id: val.id, name: ' Raka ', role: 'Duelist', pick: 'Jett', note: 'telat 10 menit' })
    expect(res.status).toBe(200)
    expect(body.slot).toBe(1)
    expect(body.player).toMatchObject({ name: 'Raka' })

    const s = await adminServer()
    const [v, c] = [s.items.find((i) => i.id === val.id)!, s.items.find((i) => i.id === cs.id)!]
    expect(v.players.map((p) => p.name)).toEqual(['Raka'])
    expect(v.players[0]).toMatchObject({ role: 'Duelist', pick: 'Jett', via: 'web', status: 'in', note: 'telat 10 menit' })
    expect(c.players).toEqual([])
  })

  it('menolak nama kembar, jarkoman mode manual, sesi selesai, dan bot', async () => {
    const open = upcoming('mlbb')
    const manual = { ...upcoming('cs2'), autoJoin: false }
    const done = { ...upcoming('repo'), status: 'done' as const }
    await publish(stateOf(open, manual, done))

    expect((await join({ id: open.id, name: 'Sinta' })).res.status).toBe(200)
    const dup = await join({ id: open.id, name: 'sinta' })
    expect(dup.res.status).toBe(409)
    expect(dup.body.code).toBe('name-taken')
    expect((await join({ id: manual.id, name: 'Bayu' })).body.code).toBe('manual')
    expect((await join({ id: done.id, name: 'Bayu' })).body.code).toBe('closed')
    expect((await join({ id: open.id, name: 'Bot', website: 'http://spam' })).res.status).toBe(400)
    expect((await join({ id: 'tidakada', name: 'Bayu' })).res.status).toBe(404)
  })

  it('role di luar daftar game dibuang, pemain setelah slot penuh jadi cadangan', async () => {
    const j = { ...upcoming('valorant'), slots: 1 }
    await publish(stateOf(j))
    await join({ id: j.id, name: 'A', role: 'Tank' })
    const second = await join({ id: j.id, name: 'B' })
    expect(second.body.slot).toBeNull()
    const s = await server()
    expect(s.items[0].players[0].role).toBe('')
  })

  it('batal ikut hanya dengan kunci dari perangkat pendaftar', async () => {
    const j = upcoming('repo')
    await publish(stateOf(j))
    const { body } = await join({ id: j.id, name: 'Dimas' })

    const forged = await joinHandler(req('/api/join', { method: 'DELETE', body: JSON.stringify({ id: j.id, player: body.player.id, key: 'palsu' }) }))
    expect(forged.status).toBe(403)

    const ok = await joinHandler(req('/api/join', { method: 'DELETE', body: JSON.stringify({ id: j.id, player: body.player.id, key: body.key }) }))
    expect(ok.status).toBe(200)
    const s = await server()
    expect(s.items[0].players).toEqual([])
    expect(s.gone.map((g) => g.id)).toEqual([body.player.id])
  })

  it('mengganti password admin tidak mematikan tombol batal ikut, kunci lama tetap berlaku', async () => {
    const j = upcoming('valorant')
    await publish(stateOf(j))
    const { body } = await join({ id: j.id, name: 'Rara' })
    // Kunci yang dibagikan sebelum rahasia pendaftar terpisah ada: ditandatangani dengan rahasia turunan password.
    const legacy = joinKey(j.id, 'lama-01', legacyJoinSecret())
    expect(verifyJoinKey(j.id, 'lama-01', legacy, (await joinSecrets(kv)).accepted)).toBe(true)

    process.env.ADMIN_PASSWORD = 'password-baru'
    const res = await joinHandler(req('/api/join', { method: 'DELETE', body: JSON.stringify({ id: j.id, player: body.player.id, key: body.key }) }))
    expect(res.status).toBe(200)
  })

  it('tanpa password dan JARKOMAN_SECRET, kunci yang bisa ditebak ditolak', async () => {
    process.env.ADMIN_PASSWORD = ''
    const guessable = joinKey('x', 'p', 'jarkoman:')
    expect(verifyJoinKey('x', 'p', guessable, (await joinSecrets(memoryStore())).accepted)).toBe(false)
  })

  it('batas pendaftaran per IP per jarkoman menahan spam, IP lain tetap bisa daftar', async () => {
    const j = upcoming('valorant')
    j.slots = 10
    await publish(stateOf(j))
    const post = (name: string, ip: string) => joinHandler(req('/api/join', { method: 'POST', body: JSON.stringify({ id: j.id, name }) }), { ip })
    for (let i = 0; i < 6; i++) expect((await post(`Spam ${i}`, '10.0.0.1')).status).toBe(200)
    const blocked = await post('Spam 7', '10.0.0.1')
    expect(blocked.status).toBe(429)
    expect(((await blocked.json()) as { code: string }).code).toBe('rate-limited')
    expect((await post('Tetangga', '10.0.0.2')).status).toBe(200)
  })

  it('catatan pemain hanya terlihat oleh admin dan tidak hilang saat admin menyimpan draft tanpa catatan', async () => {
    const j = upcoming('mlbb')
    await publish(stateOf(j))
    const { body } = await join({ id: j.id, name: 'Nadia', note: 'telat 10 menit' })
    expect(body.item.players[0].note).toBe('')

    const publicView = await server()
    expect(publicView.items[0].players[0].note).toBe('')
    const adminView = await adminServer()
    expect(adminView.items[0].players[0].note).toBe('telat 10 menit')

    // Draft dari bacaan publik (catatan kosong) disimpan admin: catatan di server tetap ada.
    const draft = structuredClone(publicView)
    draft.items[0].headline = 'Judul baru'
    const saved = await publish(draft, publicView.updatedAt)
    expect(saved.res.status).toBe(200)
    expect(saved.body.state.items[0].players[0].note).toBe('telat 10 menit')
  })

  it('simpanan admin dari draft lama tidak menghapus pendaftar baru dan tidak memunculkan lagi yang batal', async () => {
    const j = upcoming('valorant')
    const first = await publish(stateOf(j))
    const loaded = first.body.state // admin membuka dashboard di titik ini

    const early = await join({ id: j.id, name: 'Lama' }) // terlihat admin setelah refresh
    const afterLoad = cleanState(await server())!.state
    const late = await join({ id: j.id, name: 'Baru' })
    await joinHandler(req('/api/join', { method: 'DELETE', body: JSON.stringify({ id: j.id, player: early.body.player.id, key: early.body.key }) }))

    // Admin mengedit judul dari draft yang dimuat sebelum ada pendaftar.
    const draft: SiteState = { ...loaded, items: loaded.items.map((i) => ({ ...i, headline: 'Judul baru' })) }
    const saved = await publish(draft, loaded.updatedAt)
    expect(saved.res.status).toBe(200)
    expect(saved.body.state.items[0].headline).toBe('Judul baru')
    expect(saved.body.state.items[0].players.map((p) => p.name)).toEqual(['Baru'])

    // Admin yang sudah melihat "Lama" lalu menghapusnya: tidak dimunculkan lagi.
    const seen: SiteState = { ...afterLoad, updatedAt: saved.body.state.updatedAt, items: afterLoad.items.map((i) => ({ ...i, players: [] })) }
    const again = await publish(seen, saved.body.state.updatedAt)
    expect(again.body.state.items[0].players.map((p) => p.name)).toEqual(['Baru'])
    expect(late.res.status).toBe(200)
  })

  it('pendaftaran web tidak membuat admin kena konflik', async () => {
    const j = upcoming('cs2')
    const first = await publish(stateOf(j))
    await join({ id: j.id, name: 'Entry' })
    const res = await publish(first.body.state, first.body.state.updatedAt)
    expect(res.res.status).toBe(200)
  })
})

describe('logika join bersama', () => {
  it('addWebPlayer tidak mengubah state asli dan menaikkan joinSeq', () => {
    const s = stateOf(upcoming('mlbb'))
    const out = addWebPlayer(s, { id: s.items[0].id, name: 'Ling', role: 'Jungle', pick: 'Ling', note: '' })
    expect(s.items[0].players).toHaveLength(0)
    expect(out.state.joinSeq).toBe(1)
    expect(out.player.seq).toBe(1)
    expect(() => addWebPlayer(out.state, { id: s.items[0].id, name: 'LING', role: '', pick: '', note: '' })).toThrow(JoinError)
  })

  it('applyWebChanges menggabungkan ke draft tanpa menduplikasi nama yang sudah ditambah admin', () => {
    const base = stateOf(upcoming('valorant'))
    const id = base.items[0].id
    const joined = addWebPlayer(base, { id, name: 'Nadia', role: '', pick: '', note: '' }).state
    const draft: SiteState = { ...base, items: [{ ...base.items[0], players: [blankPlayer({ name: 'nadia' })] }] }
    expect(applyWebChanges(draft, joined, 0).items[0].players).toHaveLength(1)

    const left = removeWebPlayer(joined, id, joined.items[0].players[0].id).state
    const draft2: SiteState = { ...joined }
    expect(applyWebChanges(draft2, left, joined.joinSeq).items[0].players).toHaveLength(0)
  })

  it('updateJSON mengulang saat ada penulis lain di tengah jalan', async () => {
    await kv.setJSON('n', { v: 0 })
    let interfered = false
    const result = await updateJSON<{ v: number }, number>(kv, 'n', (cur) => {
      if (!interfered) {
        interfered = true
        // Penulis lain menyelip setelah kita membaca.
        void kv.setJSON('n', { v: 10 })
      }
      const v = (cur?.v ?? 0) + 1
      return { value: { v }, result: v }
    })
    expect(result).toBe(11)
    expect(await kv.getJSON('n')).toEqual({ v: 11 })
  })

  it('data lama tanpa autoJoin dianggap nyala, dan kunci form per jarkoman', () => {
    const legacy = { ...upcoming('valorant') } as Partial<Jarkoman>
    delete legacy.autoJoin
    const cleaned = cleanState({ items: [legacy] })!.state
    expect(cleaned.items[0].autoJoin).toBe(true)
    expect(cleaned.joinSeq).toBe(0)
    expect(KEYS.joinName('aaaa1111')).not.toBe(KEYS.joinName('bbbb2222'))
    expect(KEYS.joined('aaaa1111')).toContain('aaaa1111')
  })

  it('batas pendaftaran: ditolak setelah lewat, label jam benar, dan ikut di pesan broadcast', () => {
    const j = upcoming('cs2')
    j.time = '20:00'
    j.joinClose = 30
    const start = new Date(`${j.date}T20:00:00+07:00`).getTime()
    expect(joinClosed(j, start - 31 * 60_000)).toBe(false)
    expect(joinClosed(j, start - 29 * 60_000)).toBe(true)
    expect(joinCloseLabel(j)).toBe('30 menit sebelum mulai (pukul 19.30 WIB)')
    expect(joinCloseLabel({ ...j, time: '00:10', joinClose: 15 })).toContain('pukul 23.55')
    expect(joinCloseLabel({ ...j, joinClose: -1 })).toBe('')

    const state = stateOf(j)
    expect(() => addWebPlayer(state, { id: j.id, name: 'Telat' }, start - 10 * 60_000)).toThrow(/ditutup/)
    expect(addWebPlayer(state, { id: j.id, name: 'Tepat' }, start - 60 * 60_000).player.name).toBe('Tepat')
    expect(buildBroadcast(j, 'https://x.test/?id=a')).toContain('Pendaftaran ditutup 30 menit sebelum mulai')
    // Data lama tanpa field ini: tanpa batas.
    const legacy = { ...j } as Partial<Jarkoman>
    delete legacy.joinClose
    expect(cleanState({ items: [legacy] })!.state.items[0].joinClose).toBe(-1)
  })

  it('petunjuk komposisi: role yang belum ada di skuad, hanya untuk tim penuh', () => {
    const v = upcoming('valorant')
    v.players = [blankPlayer({ name: 'A', role: 'Duelist' }), blankPlayer({ name: 'B', role: 'Controller' })]
    expect(neededRoles(v)).toEqual(['Initiator', 'Sentinel'])
    expect(neededRoles({ ...v, slots: 2 })).toEqual([])
    const m = upcoming('mlbb')
    m.players = [blankPlayer({ name: 'C', role: 'Jungle' })]
    expect(neededRoles(m)).toEqual(['EXP Lane', 'Gold Lane', 'Mid Lane', 'Roam'])
    expect(neededRoles(upcoming('repo'))).toEqual([])
  })

  it('pemain bisa ubah role dan pick tanpa kehilangan slot, dan perubahan ikut ke draft admin lama', async () => {
    const j = upcoming('valorant')
    await publish(stateOf(j))
    const first = await join({ id: j.id, name: 'Satu', role: 'Duelist', pick: 'Jett' })
    const second = await join({ id: j.id, name: 'Dua' })
    const draft = await adminServer()

    const patch = (key: string, body: Record<string, unknown>) =>
      joinHandler(req('/api/join', { method: 'PATCH', body: JSON.stringify({ id: j.id, player: first.body.player.id, key, ...body }) }))
    expect((await patch('palsu', { role: 'Sentinel' })).status).toBe(403)
    const ok = await patch(first.body.key, { role: 'Sentinel', pick: 'Killjoy' })
    expect(ok.status).toBe(200)

    const s = await adminServer()
    expect(s.items[0].players.map((p) => p.name)).toEqual(['Satu', 'Dua'])
    expect(s.items[0].players[0]).toMatchObject({ role: 'Sentinel', pick: 'Killjoy' })
    expect(second.body.player.id).toBe(s.items[0].players[1].id)

    // Draft admin dibuka sebelum perubahan: menyimpan draft tidak mengembalikan role lama.
    draft.items[0].headline = 'Judul admin'
    const saved = await publish(draft, draft.updatedAt)
    expect(saved.body.state.items[0].players[0]).toMatchObject({ role: 'Sentinel', pick: 'Killjoy' })
    expect(saved.body.state.items[0].headline).toBe('Judul admin')

    // Role di luar daftar game diabaikan.
    const bad = updateWebPlayer(saved.body.state, j.id, first.body.player.id, { role: 'Tank' })
    expect(bad.player.role).toBe('Sentinel')
  })
})
