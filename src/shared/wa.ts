import { gameDef } from './games'
import { formatDateLong, formatTimeRange } from './time'
import type { Jarkoman } from './types'

/** Nomor WhatsApp tujuan konfirmasi (dari brief). */
export const DEFAULT_WA = '088223367352'

/** Ubah nomor lokal ke format internasional tanpa tanda plus: 0882... menjadi 62882... */
export function normalizePhone(input: string): string {
  let digits = (input || '').replace(/\D/g, '')
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`
  else if (digits.startsWith('8')) digits = `62${digits}`
  return digits
}

/** Tampilan nomor gaya Indonesia: 0882-2336-7352 */
export function formatPhoneDisplay(input: string): string {
  const intl = normalizePhone(input)
  if (!intl) return ''
  const local = intl.startsWith('62') ? `0${intl.slice(2)}` : intl
  const parts = [local.slice(0, 4), local.slice(4, 8), local.slice(8)].filter(Boolean)
  return parts.join('-')
}

export function waLink(phone: string, text: string): string {
  const number = normalizePhone(phone) || normalizePhone(DEFAULT_WA)
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

export function playersIn(j: Pick<Jarkoman, 'players'>): number {
  return j.players.filter((p) => p.status === 'in').length
}

export function isFull(j: Pick<Jarkoman, 'players' | 'slots'>): boolean {
  return playersIn(j) >= j.slots
}

export interface JoinForm {
  name: string
  role: string
  pick: string
  note: string
}

export function buildJoinMessage(j: Jarkoman, form: JoinForm, link: string): string {
  const def = gameDef(j.game)
  const lines: string[] = []
  lines.push('Halo, aku mau ikut jarkoman ini:')
  lines.push('')
  lines.push(`*${def.name} · ${j.headline.trim() || def.defaultHeadline}*`)
  lines.push(`Jadwal: ${formatDateLong(j.date)}, ${formatTimeRange(j)}`)
  const detail = [j.mode && `Mode: ${j.mode}`, j.map && `${def.mapLabel}: ${j.map}`].filter(Boolean).join(' | ')
  if (detail) lines.push(detail)
  lines.push('')
  lines.push(`Nama: ${form.name.trim()}`)
  if (form.role.trim()) lines.push(`${def.roleLabel}: ${form.role.trim()}`)
  if (form.pick.trim()) lines.push(`${def.pickLabel}: ${form.pick.trim()}`)
  if (form.note.trim()) lines.push(`Catatan: ${form.note.trim()}`)
  if (isFull(j)) {
    lines.push('')
    lines.push('Slot sudah penuh, aku daftar sebagai cadangan.')
  }
  if (link) {
    lines.push('')
    lines.push(`Link: ${link}`)
  }
  return lines.join('\n')
}

/** Teks siap tempel untuk grup WhatsApp (format tebal WA memakai bintang). */
export function buildBroadcast(j: Jarkoman, link: string): string {
  const def = gameDef(j.game)
  const filled = playersIn(j)
  const open = Math.max(0, j.slots - filled)
  const lines: string[] = []
  lines.push(`*JARKOMAN ${def.name}*`)
  lines.push(`*${(j.headline.trim() || def.defaultHeadline).toUpperCase()}*`)
  if (j.subline.trim()) lines.push(j.subline.trim())
  lines.push('')
  lines.push(`Kapan : ${formatDateLong(j.date)}`)
  lines.push(`Jam   : ${formatTimeRange(j)}`)
  if (j.mode) lines.push(`Mode  : ${j.mode}`)
  if (j.map) lines.push(`${def.mapLabel.padEnd(6, ' ')}: ${j.map}`)
  if (j.rank) lines.push(`${def.rankLabel.padEnd(6, ' ')}: ${j.rank}`)
  lines.push(`Slot  : ${filled}/${j.slots} terisi${open > 0 ? ` (${open} kosong)` : ' (penuh, cadangan boleh)'}`)
  if (j.host.trim()) lines.push(`Host  : ${j.host.trim()}`)
  const squad = j.players.filter((p) => p.name.trim())
  if (squad.length) {
    lines.push('')
    lines.push('Skuad:')
    squad.forEach((p, i) => {
      const extra = [p.role, p.pick].filter(Boolean).join(', ')
      const maybe = p.status === 'maybe' ? ' (belum pasti)' : ''
      lines.push(`${i + 1}. ${p.name}${extra ? ` (${extra})` : ''}${maybe}`)
    })
  }
  if (j.notes.trim()) {
    lines.push('')
    lines.push('Catatan:')
    lines.push(j.notes.trim())
  }
  lines.push('')
  lines.push(`Konfirmasi ke WA ${formatPhoneDisplay(j.wa || DEFAULT_WA)}${link ? ' atau isi di sini:' : ''}`)
  if (link) lines.push(link)
  return lines.join('\n')
}
