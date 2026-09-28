import { useEffect, useState } from 'react'

interface BgPhotoProps {
  src?: string
  className?: string
  alt?: string
}

/** Gambar latar dari sumber luar. Tidak mengganggu layout saat memuat, dan hilang total kalau gagal. */
export function BgPhoto({ src, className = '', alt = '' }: BgPhotoProps) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading')
  useEffect(() => setState('loading'), [src])
  if (!src || state === 'error') return null
  return (
    <img
      src={src}
      alt={alt}
      className={`bg-photo ${state === 'loaded' ? 'is-loaded' : ''} ${className}`}
      referrerPolicy="no-referrer"
      decoding="async"
      onLoad={() => setState('loaded')}
      onError={() => setState('error')}
    />
  )
}
