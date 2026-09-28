import { gameDef } from '../../shared/games'
import { buildIcs } from '../../shared/ics'
import type { Jarkoman } from '../../shared/types'
import { pageLink } from './hooks'

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback untuk konteks non-HTTPS atau browser lama.
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    area.remove()
    return ok
  }
}

/** Bagikan lewat share sheet bawaan HP, atau salin link di desktop. Mengembalikan pesan untuk toast. */
export async function shareJarkoman(j: Jarkoman): Promise<string | null> {
  const def = gameDef(j.game)
  const url = pageLink(j)
  const title = `${def.name}: ${j.headline}`
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text: `${title}. Cek slot dan konfirmasi di sini:`, url })
      return null
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return null
    }
  }
  return (await copyText(url)) ? 'Link jarkoman disalin.' : 'Gagal menyalin. Salin manual dari address bar.'
}

export function downloadIcs(j: Jarkoman): string {
  const ics = buildIcs(j, pageLink(j))
  if (!ics) return 'Tanggal atau jam belum valid.'
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `jarkoman-${j.game}-${j.date}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'File kalender diunduh. Buka untuk menambahkan pengingat.'
}
