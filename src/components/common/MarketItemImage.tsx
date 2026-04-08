'use client'

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
}

/**
 * 마켓 기본 상품 일러스트 — 예전 스프라이트 시트 대신 `items/shop/items/*.png` 한 장씩 표시합니다.
 * 가로·세로 한쪽만 주면 비율을 유지한 채 맞춥니다(SpriteImage 와 비슷한 느낌).
 */
export default function MarketItemImage({ frame, width, height, className, style }: MarketItemImageProps) {
  const imgStyle: CSSProperties = {
    objectFit: 'contain',
    objectPosition: 'bottom',
    maxWidth: '100%',
    maxHeight: '100%',
    ...style,
  }
  if (width != null && height != null) {
    imgStyle.width = width
    imgStyle.height = height
  } else if (height != null) {
    imgStyle.height = height
    imgStyle.width = 'auto'
  } else if (width != null) {
    imgStyle.width = width
    imgStyle.height = 'auto'
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- 로컬 정적 마켓 자산
    <img
      src={marketItemImageUrl(frame)}
      alt=""
      className={className}
      style={imgStyle}
      draggable={false}
    />
  )
}
