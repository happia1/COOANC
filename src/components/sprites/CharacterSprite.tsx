import SpriteImage from '@/components/common/SpriteImage'
import {
  BEARS, BUNNY, CHICKS, FOX, HAMSTER, OTTER, BUNNY_RUN,
  type BearFrameName,
  type BunnyFrameName,
  type ChicksFrameName,
  type FoxFrameName,
  type HamsterFrameName,
  type OtterFrameName,
  type BunnyRunFrameName,
} from '@/constants/sprites'
import type { CSSProperties } from 'react'

export type CharacterName = 'bears' | 'bunny' | 'chicks' | 'fox' | 'hamster' | 'otter'
export type BunnyRunFrame = BunnyRunFrameName
export type { BearFrameName, BunnyFrameName, ChicksFrameName, FoxFrameName, HamsterFrameName, OtterFrameName }

const SHEETS = {
  bears: BEARS,
  bunny: BUNNY,
  chicks: CHICKS,
  fox: FOX,
  hamster: HAMSTER,
  otter: OTTER,
}

interface CharacterSpriteProps {
  character: CharacterName
  frame: BearFrameName | BunnyFrameName | ChicksFrameName | FoxFrameName | HamsterFrameName | OtterFrameName
  width?: number
  height?: number
  className?: string
  style?: CSSProperties
}

/** Render a base character frame. */
export function CharacterSprite({ character, frame, ...rest }: CharacterSpriteProps) {
  return <SpriteImage sheet={SHEETS[character]} frame={frame} {...rest} />
}

interface BunnyRunSpriteProps {
  frame: BunnyRunFrameName
  width?: number
  height?: number
  className?: string
  style?: CSSProperties
}

/** Render a single frame of the bunny_run onboarding animation. */
export function BunnyRunSprite({ frame, ...rest }: BunnyRunSpriteProps) {
  return <SpriteImage sheet={BUNNY_RUN} frame={frame} {...rest} />
}
