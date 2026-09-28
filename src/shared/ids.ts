const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** ID pendek acak (huruf kecil dan angka), cukup unik untuk puluhan jarkoman. */
export function uid(length = 8): string {
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length]
  return out
}
