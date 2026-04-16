'use client'

import Image from 'next/image'
import type { CSSProperties } from 'react'
import type { MarketItemImageKey } from '@/constants/marketItemImages'
import { marketItemImageUrl } from '@/constants/marketItemImages'

export interface MarketItemImageProps {
  /** 폴더 내 PNG 파일명과 같은 키(예: chips, chocolate (2)) */
  frame: MarketItemImageKey
  width?: number
  height?: number
  className?: string
  style?: CSSProperties
  /** 첫 선반 상단 등 — Next 가 우선 로드 */
  priority?: boolean
  loading?: 'lazy' | 'eager'
  sizes?: string
}

/**
 * 마켓 기본 상품 일러스트 — `items/shop/items/*.png` 한 장씩 표시합니다.
 * Next.js Image 로 WebP/AVIF 변환·크기 최적화를 받습니다.
 */
export default function MarketItemImage({
  frame,
  width,
  height,
  className,
  style,
  priority = false,
  loading = 'lazy',
  sizes,
}: MarketItemImageProps) {
  const src = marketItemImageUrl(frame)
  let w: number
  let h: number
  if (width != null && height != null) {
    w = width
    h = height
  } else if (height != null) {
    h = height
    w = Math.max(32, Math.round(h * 1.22))
  } else if (width != null) {
    w = width
    h = Math.max(28, Math.round(w / 1.22))
  } else {
    h = 44
    w = Math.max(32, Math.round(h * 1.22))
  }

  const imgStyle: CSSProperties = {
    objectFit: 'contain',
    objectPosition: 'bottom',
    maxWidth: '100%',
    maxHeight: '100%',
    ...style,
  }

  return (
    <Image
      src={src}
      alt=""
      width={w}
      height={h}
      className={className}
      style={imgStyle}
      draggable={false}
      priority={priority}
      loading={priority ? undefined : loading}
      sizes={sizes ?? `(max-width: 640px) ${Math.min(w * 2, 128)}px, ${w}px`}
    />
  )
}
