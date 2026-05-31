'use client'

/**
 * 마켓 상품 썸네일 — DB `image_url`(스토리지 등)이 있으면 Next Image 로 최적화하고,
 * 없으면 `public/assets/img/items/shop/items/*.png` 기본 일러스트(`MarketItemImage`)를 씁니다.
 * 비개발자: 작은 카드·큰 팝업 모두 같은 규칙으로 그림만 바꿔 씁니다.
 */

import Image from 'next/image'
import type { CSSProperties } from 'react'
import MarketItemImage from '@/components/common/MarketItemImage'
import type { MarketItemFrameKey } from '@/lib/marketItemFrame'
import { resolveStoreItemImageUrl } from '@/constants/marketItemImages'

export type StoreItemThumbnailProps = {
  imageUrl: string | null | undefined
  frame: MarketItemFrameKey
  /** 카탈로그 기본 일러스트 — 이름으로 올바른 PNG 를 고릅니다 */
  itemName?: string
  /** 세로 기준(px) — 가로는 비율로 맞추거나 width 를 함께 주면 고정합니다 */
  height: number
  width?: number
  className?: string
  style?: CSSProperties
  /** 첫 화면 상단 등 LCP 후보 */
  priority?: boolean
  loading?: 'lazy' | 'eager'
  sizes?: string
}

export default function StoreItemThumbnail({
  imageUrl,
  frame,
  itemName,
  height,
  width,
  className,
  style,
  priority = false,
  loading = 'lazy',
  sizes,
}: StoreItemThumbnailProps) {
  const w = width ?? Math.max(28, Math.round(height * 1.22))

  const resolvedUrl =
    itemName != null && itemName.trim()
      ? resolveStoreItemImageUrl(itemName, imageUrl)
      : imageUrl?.trim() || null

  if (resolvedUrl) {
    return (
      <Image
        src={resolvedUrl}
        alt=""
        width={w}
        height={height}
        className={className}
        style={style}
        draggable={false}
        priority={priority}
        loading={priority ? undefined : loading}
        sizes={sizes ?? `${Math.max(w, height)}px`}
      />
    )
  }

  return (
    <MarketItemImage
      frame={frame}
      width={width}
      height={height}
      className={className}
      style={style}
      priority={priority}
      loading={priority ? undefined : loading}
      sizes={sizes}
    />
  )
}
