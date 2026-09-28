import { pad2 } from '../../shared/time'

/**
 * Dua digit hitung mundur. Tiap digit diberi key sesuai nilainya, jadi saat angka berubah
 * elemen baru dipasang dan animasi CSS `digit-in` (didefinisikan tiap tema) berjalan.
 */
export function Digits({ value, className = '' }: { value: number; className?: string }) {
  const text = value > 99 ? String(value) : pad2(value)
  return (
    <span className={`digits ${className}`}>
      {Array.from(text).map((d, i) => (
        <span className="digit" key={`${i}-${d}`}>
          {d}
        </span>
      ))}
    </span>
  )
}
