import { CSSProperties } from 'react'
import type { SpriteSheet } from '@/constants/sprites'

interface SpriteImageProps {
  sheet: SpriteSheet
  frame: string
  /** Display width in px. If omitted, uses the frame's natural width. */
  width?: number
  /** Display height in px. If omitted, uses the frame's natural height. */
  height?: number
  /**
   * 회전(`rotated: true`) 프레임만 해당. false 이면 바깥 박스를 `overflow:visible` 로 해
   * 안티앨리어싱 가장자리가 잘려 보이는 것을 줄임 (다른 스프라이트는 기본 true 유지).
   */
  clipRotated?: boolean
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
  clipRotated = true,
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
    let dW = width ?? naturalW
    let dH = height ?? naturalH
    /**
     * 한쪽만 지정하면 같은 비율로 맞춤 — 안 하면 가로·세로 배율이 달라지고,
     * 회전 프레임은 바깥 `overflow:hidden` 에서 그림 한쪽(예: 오른쪽)이 잘린 것처럼 보일 수 있음.
     */
    if (width != null && height == null) {
      const s = dW / naturalW
      dH = Math.round(naturalH * s)
    } else if (height != null && width == null) {
      const s = dH / naturalH
      dW = Math.round(naturalW * s)
    }

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
      overflow: clipRotated ? 'hidden' : 'visible',
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
  let dW = width ?? naturalW
  let dH = height ?? naturalH
  if (width != null && height == null) {
    const s = dW / naturalW
    dH = Math.round(naturalH * s)
  } else if (height != null && width == null) {
    const s = dH / naturalH
    dW = Math.round(naturalW * s)
  }
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
    /** 부모가 잘못 클립하는 환경에서도 배경이 잘리지 않도록 명시(기본값과 동일하지만 의도를 드러냄) */
    overflow: 'visible',
    ...style,
  }

  return <div className={className} style={divStyle} />
}
