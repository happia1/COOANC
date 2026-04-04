import SpriteImage from '@/components/common/SpriteImage'
import { BANNERS, type BannerFrameName } from '@/constants/sprites'
import type { CSSProperties } from 'react'

export type { BannerFrameName }

interface BannerSpriteProps {
  frame: BannerFrameName
  width?: number
  height?: number
  className?: string
  style?: CSSProperties
}

export function BannerSprite({ frame, ...rest }: BannerSpriteProps) {
  return <SpriteImage sheet={BANNERS} frame={frame} {...rest} />
}
