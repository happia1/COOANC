import SpriteImage from '@/components/common/SpriteImage'
import { ROUTINES_01, type RoutineFrameName } from '@/constants/sprites'
import type { CSSProperties } from 'react'

export type { RoutineFrameName }

interface MissionSpriteProps {
  name: RoutineFrameName
  width?: number
  height?: number
  className?: string
  style?: CSSProperties
}

/**
 * Render a mission/routine icon from the routines_01 sprite sheet.
 *
 * @example
 * <MissionSprite name="brush_teeth" width={80} height={80} />
 */
export function MissionSprite({ name, ...rest }: MissionSpriteProps) {
  return <SpriteImage sheet={ROUTINES_01} frame={name} {...rest} />
}
