import SpriteImage from '@/components/common/SpriteImage'
import { BALLOONS, type BalloonFrameName } from '@/constants/sprites'
import type { CSSProperties } from 'react'

export type { BalloonFrameName }

interface BalloonSpriteProps {
  frame: BalloonFrameName
  width?: number
  height?: number
  className?: string
  style?: CSSProperties
}

export function BalloonSprite({ frame, ...rest }: BalloonSpriteProps) {
  return <SpriteImage sheet={BALLOONS} frame={frame} {...rest} />
}
