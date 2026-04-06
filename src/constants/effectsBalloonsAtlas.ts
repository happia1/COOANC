import type { SpriteSheet } from '@/constants/sprites'

/**
 * `public/assets/img/games/effects/balloons.json` 과 같은 도장(balloons.png).
 * 미션 완료 시 크레딧 주변 반짝 조각으로 사용 — PNG 가 없으면 컴포넌트에서 CSS 로 대체.
 */
export const EFFECT_BALLOONS: SpriteSheet = {
  image: 'games/effects/balloons.png',
  atlasW: 992,
  atlasH: 172,
  frames: {
    balloon_2: { x: 178, y: 2, w: 107, h: 141, rotated: false },
    blue: { x: 709, y: 2, w: 69, h: 142, rotated: false },
    green: { x: 780, y: 2, w: 68, h: 142, rotated: false },
    red: { x: 850, y: 2, w: 69, h: 142, rotated: false },
    yellow: { x: 921, y: 2, w: 69, h: 142, rotated: false },
  },
}
