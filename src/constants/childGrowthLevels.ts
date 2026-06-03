/**
 * 아이 성장 지도 — 해금 레벨에만 단계 이름 부여 (v3 기획 확정)
 *
 * 세계관 구간:
 * - 정원: Lv.0~4 (적응·습관)
 * - 마을: Lv.5~8 (경제 입문·저축·소비)
 * - 항구: Lv.9~12 (거래·감정 표현, 일부 향후)
 * - 바다: Lv.13~ (베타 이후 예정)
 *
 * Lv.2~4, 6~7, 9, 11 등 이름 없는 레벨은 `childGrowthStageName()` 이 「레벨 N」을 반환합니다.
 */

export const CHILD_GROWTH_LEVELS = [
  { level: 0, name: '씨앗', zone: '정원' },
  { level: 1, name: '새싹', zone: '정원' },
  { level: 5, name: '저축왕', zone: '마을' },
  { level: 8, name: '사업가', zone: '마을' },
  { level: 10, name: '탐험가', zone: '항구' },
  { level: 12, name: '선장', zone: '항구' },
] as const

export type ChildGrowthLevelEntry = (typeof CHILD_GROWTH_LEVELS)[number]

/** 해금 마일스톤 레벨만 단계 이름, 그 외(중간·13+)는 「레벨 N」 */
export function childGrowthStageName(level: number): string {
  const hit = CHILD_GROWTH_LEVELS.find((it) => it.level === level)
  return hit?.name ?? `레벨 ${level}`
}
