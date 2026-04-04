import SpriteImage from '@/components/common/SpriteImage'
import { CONGRATS, type CongratsFrameName } from '@/constants/sprites'
import type { CSSProperties } from 'react'

export type { CongratsFrameName }

interface CongratsSpriteProps {
  frame: CongratsFrameName
  width?: number
  height?: number
  className?: string
  style?: CSSProperties
}

export function CongratsSprite({ frame, ...rest }: CongratsSpriteProps) {
  return <SpriteImage sheet={CONGRATS} frame={frame} {...rest} />
}
