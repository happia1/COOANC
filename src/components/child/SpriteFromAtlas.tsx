'use client'

import type { AnimationsAtlasFile } from '@/lib/shopAnimationsAtlas'
import { spriteBackgroundStyle } from '@/lib/shopAnimationsAtlas'

type Props = {
  atlas: AnimationsAtlasFile | null
  frameKey: string
  /** 표시 너비·높이(px) */
  width: number
  height: number
  className?: string
  label?: string
}

/**
 * animations.png 스프라이트에서 한 프레임만 잘라 보여줍니다.
 */
export default function SpriteFromAtlas({ atlas, frameKey, width, height, className = '', label }: Props) {
  const style = atlas ? spriteBackgroundStyle(atlas, frameKey, width, height) : null
  if (!style) {
    return (
      <div
        className={`rounded-lg bg-gray-200/80 ${className}`}
        style={{ width, height }}
        role={label ? 'img' : undefined}
        aria-label={label}
      />
    )
  }
  return <div className={className} style={style} role={label ? 'img' : undefined} aria-label={label} />
}
