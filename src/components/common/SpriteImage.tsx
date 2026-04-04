import { CSSProperties } from 'react'
import type { SpriteSheet } from '@/constants/sprites'

interface SpriteImageProps {
  sheet: SpriteSheet
  frame: string
  /** Display width in px. If omitted, uses the frame's natural width. */
  width?: number
  /** Display height in px. If omitted, uses the frame's natural height. */
  height?: number
  className?: string
  style?: CSSProperties
}

/**
 * Renders a single frame from a TexturePacker sprite sheet using CSS
 * background-image + background-position.
 *
 * TexturePacker "rotated: true" means the frame was rotated 90° CW in the
 * atlas, so we counter-rotate it back with CSS transform.
 */
export default function SpriteImage({
  sheet,
  frame,
  width,
  height,
  className,
  style,
}: SpriteImageProps) {
  // Strip .png extension if caller passes it
  const key = frame.endsWith('.png') ? frame.slice(0, -4) : frame
  const f = sheet.frames[key]

  if (!f) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`SpriteImage: frame "${key}" not found in ${sheet.image}`)
    }
    return null
  }

  const src = `/assets/img/${sheet.image}`
  const { atlasW, atlasH } = sheet

  if (f.rotated) {
    // Atlas region: f.w × f.h (but visually the sprite is f.h wide, f.w tall)
    const naturalW = f.h  // visual width  (atlas height dimension)
    const naturalH = f.w  // visual height (atlas width  dimension)
    const dW = width  ?? naturalW
    const dH = height ?? naturalH

    // Scale factors relative to the atlas
    // dW maps to naturalW (= f.h in atlas), dH maps to naturalH (= f.w in atlas)
    const scaleX = dW / naturalW   // scales atlas-Y axis
    const scaleY = dH / naturalH   // scales atlas-X axis

    // The inner div renders the atlas region in atlas orientation (rotated),
    // so its "width" is dH and its "height" is dW (swapped).
    const innerStyle: CSSProperties = {
      width: dH,
      height: dW,
      backgroundImage: `url(${src})`,
      // Axes are swapped: atlas X → scaleY, atlas Y → scaleX
      backgroundSize: `${atlasW * scaleY}px ${atlasH * scaleX}px`,
      backgroundPosition: `-${f.x * scaleY}px -${f.y * scaleX}px`,
      backgroundRepeat: 'no-repeat',
      transform: 'rotate(-90deg) translateX(-100%)',
      transformOrigin: 'top left',
      flexShrink: 0,
    }

    const outerStyle: CSSProperties = {
      width: dW,
      height: dH,
      overflow: 'hidden',
      position: 'relative',
      display: 'inline-block',
      flexShrink: 0,
      ...style,
    }

    return (
      <div className={className} style={outerStyle}>
        <div style={innerStyle} />
      </div>
    )
  }

  // Non-rotated: straightforward background-position
  const naturalW = f.w
  const naturalH = f.h
  const dW = width  ?? naturalW
  const dH = height ?? naturalH
  const scaleX = dW / naturalW
  const scaleY = dH / naturalH

  const divStyle: CSSProperties = {
    width: dW,
    height: dH,
    backgroundImage: `url(${src})`,
    backgroundSize: `${atlasW * scaleX}px ${atlasH * scaleY}px`,
    backgroundPosition: `-${f.x * scaleX}px -${f.y * scaleY}px`,
    backgroundRepeat: 'no-repeat',
    display: 'inline-block',
    flexShrink: 0,
    ...style,
  }

  return <div className={className} style={divStyle} />
}
