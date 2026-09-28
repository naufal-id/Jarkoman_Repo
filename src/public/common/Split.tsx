import type { CSSProperties, ElementType } from 'react'

interface SplitProps {
  text: string
  as?: ElementType
  className?: string
  /** 'chars' membungkus tiap huruf, 'words' hanya kata, 'lines' memecah di baris baru (\n) */
  by?: 'chars' | 'words' | 'lines'
  id?: string
  style?: CSSProperties
}

/**
 * Memecah teks menjadi span yang bisa dianimasikan GSAP tanpa memodifikasi DOM di luar React.
 * Pembaca layar membaca teks utuh lewat span sr-only, potongan visual disembunyikan.
 */
export function Split({ text, as: Tag = 'span', className, by = 'chars', id, style }: SplitProps) {
  const lines = by === 'lines' ? text.split('\n') : [text]
  return (
    <Tag className={className} id={id} style={style}>
      <span className="sr-only">{text.replace(/\n/g, ' ')}</span>
      <span aria-hidden="true" className="split">
        {lines.map((line, li) => (
          <span className="split-line" key={li}>
            {line.split(/(\s+)/).map((word, wi) =>
              /^\s+$/.test(word) ? (
                ' '
              ) : (
                <span className="split-word" key={wi}>
                  {by === 'chars'
                    ? Array.from(word).map((ch, ci) => (
                        <span className="split-char" key={ci}>
                          {ch}
                        </span>
                      ))
                    : word}
                </span>
              ),
            )}
          </span>
        ))}
      </span>
    </Tag>
  )
}
