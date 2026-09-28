import { useEffect, useState } from 'react'
import { artSrcSet, KEY_ART } from '../../shared/art'
import type { GameId } from '../../shared/types'

interface ArtImageProps {
  game: GameId
  /** URL gambar pilihan admin. Kalau gagal dimuat, kembali ke key art bawaan. */
  custom?: string
  className?: string
  sizes?: string
  priority?: boolean
}

/** Gambar utama tema: key art bawaan atau gambar pilihan admin, dengan fade-in dan fallback. */
export function ArtImage({ game, custom, className = '', sizes = '100vw', priority }: ArtImageProps) {
  const [failed, setFailed] = useState(false)
  // Menyimpan src yang sudah selesai dimuat, supaya ganti gambar tidak perlu reset state terpisah.
  const [loadedSrc, setLoadedSrc] = useState('')
  const art = KEY_ART[game]
  const useCustom = Boolean(custom) && !failed
  const src = useCustom ? custom! : art.src

  useEffect(() => {
    setFailed(false)
  }, [custom])

  return (
    <img
      ref={(el) => {
        // Gambar dari cache bisa sudah selesai sebelum onLoad terpasang.
        if (el?.complete && el.naturalWidth > 0 && loadedSrc !== src) setLoadedSrc(src)
      }}
      className={`art-img ${loadedSrc === src ? 'is-loaded' : ''} ${className}`}
      src={src}
      srcSet={useCustom ? undefined : artSrcSet(game)}
      sizes={sizes}
      width={useCustom ? undefined : art.w}
      height={useCustom ? undefined : art.h}
      alt=""
      decoding="async"
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      referrerPolicy={useCustom ? 'no-referrer' : undefined}
      onLoad={() => setLoadedSrc(src)}
      onError={() => {
        if (useCustom) setFailed(true)
      }}
    />
  )
}
