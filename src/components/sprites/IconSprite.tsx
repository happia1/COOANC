import SpriteImage from '@/components/common/SpriteImage'
import {
  ICONS, MODE,
  type IconFrameName,
  type ModeFrameName,
} from '@/constants/sprites'
import type { CSSProperties } from 'react'

export type { IconFrameName, ModeFrameName }

interface IconSpriteProps {
  name: IconFrameName
  width?: number
  height?: number
  className?: string
  style?: CSSProperties
}

/** UI icon from the icons sprite sheet. */
export function IconSprite({ name, ...rest }: IconSpriteProps) {
  return <SpriteImage sheet={ICONS} frame={name} {...rest} />
}

interface ModeSpriteProps {
  name: ModeFrameName
  width?: number
  height?: number
  className?: string
  style?: CSSProperties
}

/** Mode indicator (morning / sleep_mode). */
export function ModeSprite({ name, ...rest }: ModeSpriteProps) {
  return <SpriteImage sheet={MODE} frame={name} {...rest} />
}
