import type { CSSProperties } from 'react'

/**
 * 마켓 애니메이션 스프라이트(animations.png + animations.json)를 화면에 맞게 쓰기 위한 타입·상수입니다.
 * JSON 파일은 런타임에 fetch 하므로, 여기에는 허용 키 목록만 둡니다.
 */

export type AnimationFrameRect = {
  x: number
  y: number
  w: number
  h: number
}

export type AnimationsAtlasFile = {
  frames: Record<string, { frame: AnimationFrameRect; rotated?: boolean }>
  meta: { image: string; size: { w: number; h: number } }
}

/** 부모가 보낼 수 있는 작은 스티커(animations.json 안의 파일명) */
export const PRAISE_STICKER_FRAME_KEYS = ['tag.png', 'reward.png', 'message.png'] as const
export type PraiseStickerFrameKey = (typeof PRAISE_STICKER_FRAME_KEYS)[number]

/** 곰돌이 스티커 판 배경 프레임 */
export const STICKER_BOARD_FRAME_KEY = 'sticker_board.png'

const SHEET_BASE = '/assets/img/items/shop'

/** TexturePacker 가보낸 스프라이트 이미지 URL(저장소에 파일이 있어야 보입니다) */
export function animationsSheetUrl(atlas: AnimationsAtlasFile): string {
  return `${SHEET_BASE}/${atlas.meta.image}`
}

/**
 * 한 프레임을 div 배경으로 깔 때 쓰는 인라인 스타일을 만듭니다.
 * @param displayW 화면에 그릴 너비(px)
 * @param displayH 화면에 그릴 높이(px)
 */
export function spriteBackgroundStyle(
  atlas: AnimationsAtlasFile,
  frameKey: string,
  displayW: number,
  displayH: number,
): CSSProperties | null {
  const entry = atlas.frames[frameKey]
  if (!entry) return null
  const { x, y, w, h } = entry.frame
  const { w: mw, h: mh } = atlas.meta.size
  const scaleX = displayW / w
  const scaleY = displayH / h
  const bgw = mw * scaleX
  const bgh = mh * scaleY
  const posX = x * scaleX
  const posY = y * scaleY
  return {
    width: displayW,
    height: displayH,
    backgroundImage: `url("${animationsSheetUrl(atlas)}")`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${bgw}px ${bgh}px`,
    backgroundPosition: `-${posX}px -${posY}px`,
  }
}
