/**
 * 칭찬 스티커 UI 아이콘 — public/img/common/ui/icons/icons.png (TexturePacker 산출물, 226×825).
 * 아이콘은 균등 격자가 아니라 JSON( public/assets/img/common/ui/icons.json )의 frame 좌표로만 잘라야 합니다.
 */

export const PRAISE_UI_ICON_SHEET = '/img/common/ui/icons/icons.png'

/** DB sprite_key 에 저장되는 값 (부모 패널·API 검증용) */
export const PRAISE_UI_SPRITE_KEYS = [
  'ui:winged_star',
  'ui:heart_face',
  'ui:heart',
  'ui:star',
] as const

export type PraiseUiSpriteKey = (typeof PRAISE_UI_SPRITE_KEYS)[number]

export type PraiseUiKind = 'winged_star' | 'heart_face' | 'heart' | 'star'

/** 원본 스프라이트 시트 픽셀 크기 (meta.size 와 동일) */
export const PRAISE_UI_SHEET_W = 226
export const PRAISE_UI_SHEET_H = 825

/**
 * TexturePacker frames — kind별 원본 PNG 이름과 대응:
 * winged_star → star_with_wing, heart_face → happy, heart → heart, star → star
 */
export const PRAISE_UI_FRAME: Record<PraiseUiKind, { x: number; y: number; w: number; h: number }> = {
  winged_star: { x: 3, y: 3, w: 97, h: 61 },
  heart_face: { x: 104, y: 3, w: 93, h: 78 },
  heart: { x: 3, y: 68, w: 94, h: 82 },
  star: { x: 3, y: 154, w: 88, h: 85 },
}

export function isPraiseUiSpriteKey(key: string): key is PraiseUiSpriteKey {
  return (PRAISE_UI_SPRITE_KEYS as readonly string[]).includes(key)
}

/** ui:heart_face → heart_face */
export function praiseUiKindFromSpriteKey(key: string): PraiseUiKind | null {
  if (!key.startsWith('ui:')) return null
  const k = key.slice(3)
  if (k === 'winged_star' || k === 'heart_face' || k === 'heart' || k === 'star') return k
  return null
}
