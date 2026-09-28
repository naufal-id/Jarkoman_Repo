import { describe, expect, it } from 'vitest'
import { createJarkoman, switchGame } from '../src/shared/defaults'
import { buildIcs } from '../src/shared/ics'
import { cleanState, cleanUrl } from '../src/shared/sanitize'
import {
  countdownParts,
  endEpoch,
  formatDateLong,
  formatTimeRange,
  liveState,
  nextSaturday,
  relativeDay,
  startEpoch,
} from '../src/shared/time'
import { buildBroadcast, buildJoinMessage, formatPhoneDisplay, normalizePhone, waLink } from '../src/shared/wa'

// 2026-09-28 10:00 WIB (Senin)
const NOW = Date.UTC(2026, 8, 28, 3, 0)

describe('waktu', () => {
  it('menghitung epoch mulai sesuai zona', () => {
    const base = { date: '2026-10-03', time: '20:00' }
    expect(startEpoch({ ...base, tz: 'WIB' })).toBe(Date.UTC(2026, 9, 3, 13, 0))
    expect(startEpoch({ ...base, tz: 'WITA' })).toBe(Date.UTC(2026, 9, 3, 12, 0))
    expect(startEpoch({ ...base, tz: 'WIT' })).toBe(Date.UTC(2026, 9, 3, 11, 0))
  })

  it('jam selesai lewat tengah malam dianggap hari berikutnya', () => {
    const j = { date: '2026-10-03', time: '22:00', endTime: '01:00', tz: 'WIB' as const }
    expect(endEpoch(j)! - startEpoch(j)!).toBe(3 * 3600_000)
  })

  it('tanpa jam selesai berarti 3 jam', () => {
    const j = { date: '2026-10-03', time: '20:00', endTime: '', tz: 'WIB' as const }
    expect(endEpoch(j)! - startEpoch(j)!).toBe(3 * 3600_000)
  })

  it('menolak tanggal tidak valid', () => {
    expect(startEpoch({ date: '2026-02-30', time: '20:00', tz: 'WIB' })).toBeNull()
    expect(formatDateLong('bukan-tanggal')).toBe('Tanggal belum diatur')
  })

  it('format tanggal dan jam bahasa Indonesia', () => {
    expect(formatDateLong('2026-10-03')).toBe('Sabtu, 3 Oktober 2026')
    expect(formatTimeRange({ time: '20:00', endTime: '23:30', tz: 'WIB' })).toBe('20.00 sampai 23.30 WIB')
    expect(formatTimeRange({ time: '08:05', endTime: '', tz: 'WIT' })).toBe('08.05 WIT')
  })

  it('status otomatis mengikuti waktu', () => {
    const j = createJarkoman('valorant', NOW)
    j.date = '2026-09-28'
    j.time = '09:00'
    j.endTime = '11:00'
    expect(liveState(j, NOW)).toBe('live')
    j.time = '11:00'
    j.endTime = '12:00'
    expect(liveState(j, NOW)).toBe('upcoming')
    j.date = '2026-09-27'
    expect(liveState(j, NOW)).toBe('ended')
    j.status = 'cancelled'
    expect(liveState(j, NOW)).toBe('cancelled')
  })

  it('Sabtu terdekat dan label relatif', () => {
    expect(nextSaturday('WIB', NOW)).toBe('2026-10-03')
    // Sabtu 21.00 WIB, sudah lewat jam 20.00 -> Sabtu depan
    expect(nextSaturday('WIB', Date.UTC(2026, 9, 3, 14, 0))).toBe('2026-10-10')
    expect(relativeDay({ date: '2026-09-29', tz: 'WIB' }, NOW)).toBe('besok')
    expect(relativeDay({ date: '2026-09-28', tz: 'WIB' }, NOW)).toBe('hari ini')
  })

  it('pecahan hitung mundur', () => {
    expect(countdownParts(90_061_000)).toMatchObject({ days: 1, hours: 1, minutes: 1, seconds: 1 })
    expect(countdownParts(-5).total).toBe(0)
  })
})

describe('whatsapp', () => {
  it('normalisasi nomor brief', () => {
    expect(normalizePhone('088223367352')).toBe('6288223367352')
    expect(normalizePhone('+62 882-2336-7352')).toBe('6288223367352')
    expect(normalizePhone('88223367352')).toBe('6288223367352')
    expect(formatPhoneDisplay('088223367352')).toBe('0882-2336-7352')
  })

  it('link wa.me berisi pesan ter-encode', () => {
    const url = waLink('088223367352', 'Halo & gas?')
    expect(url).toBe('https://wa.me/6288223367352?text=Halo%20%26%20gas%3F')
  })

  it('pesan join memuat detail dan status cadangan saat penuh', () => {
    const j = createJarkoman('valorant', NOW)
    j.slots = 1
    j.players = [{ id: 'p1', name: 'Raka', role: 'Duelist', pick: 'Jett', status: 'in' }]
    const msg = buildJoinMessage(j, { name: ' Dimas ', role: 'Sentinel', pick: 'Killjoy', note: '' }, 'https://x.test/?id=abc')
    expect(msg).toContain('Nama: Dimas')
    expect(msg).toContain('Agent: Killjoy')
    expect(msg).toContain('cadangan')
    expect(msg).toContain('https://x.test/?id=abc')
    expect(msg).not.toContain('\u2014')
  })

  it('teks broadcast menampilkan slot dan skuad', () => {
    const j = createJarkoman('mlbb', NOW)
    j.players = [
      { id: 'p1', name: 'Sinta', role: 'Gold Lane', pick: 'Beatrix', status: 'in' },
      { id: 'p2', name: 'Bayu', role: 'Roam', pick: '', status: 'maybe' },
    ]
    const text = buildBroadcast(j, 'https://x.test')
    expect(text).toContain('Slot  : 1/5 terisi (4 kosong)')
    expect(text).toContain('2. Bayu (Roam) (belum pasti)')
    expect(text).toContain('0882-2336-7352')
  })
})

describe('kalender', () => {
  it('membuat file ics yang valid', () => {
    const j = createJarkoman('cs2', NOW)
    j.headline = 'Push B, bareng; santai'
    const ics = buildIcs(j, 'https://x.test/?id=1', NOW)!
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('DTSTART:20261003T130000Z')
    expect(ics).toContain('DTEND:20261003T160000Z')
    expect(ics).toContain('SUMMARY:CS2: Push B\\, bareng\\; santai')
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
  })
})

describe('sanitasi', () => {
  it('membersihkan input berbahaya dan menolak item rusak', () => {
    const good = createJarkoman('repo', NOW)
    const result = cleanState({
      featuredId: 'tidak-ada',
      items: [
        { ...good, headline: '  <b>Shift</b>\u0007  malam  ', slots: 99, bg: 'javascript:alert(1)', voice: 'https://discord.gg/abc' },
        { game: 'valorant' },
        'sampah',
      ],
    })!
    expect(result.dropped).toBe(2)
    const item = result.state.items[0]
    expect(item.headline).toBe('<b>Shift</b> malam')
    expect(item.slots).toBe(6)
    expect(item.bg).toBe('')
    expect(item.voice).toBe('https://discord.gg/abc')
    expect(result.state.featuredId).toBe(item.id)
  })

  it('URL hanya http/https', () => {
    expect(cleanUrl('ftp://x')).toBe('')
    expect(cleanUrl('https://a.b/c.jpg')).toBe('https://a.b/c.jpg')
  })

  it('ganti game menyesuaikan field khusus game', () => {
    const j = createJarkoman('valorant', NOW)
    j.players = [{ id: 'p1', name: 'A', role: 'Duelist', pick: 'Jett', status: 'in' }]
    const next = switchGame(j, 'repo')
    expect(next.game).toBe('repo')
    expect(next.slots).toBe(6)
    expect(next.map).toBe('Acak')
    expect(next.players[0]).toMatchObject({ name: 'A', role: '', pick: '' })
    expect(next.headline).toBe('Shift Malam')
  })
})
