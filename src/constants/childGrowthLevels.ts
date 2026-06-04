/**
 * 아이 성장 — 레벨·존·뱃지 (독립 개념)
 *
 * - 레벨: 숫자만 (Lv.N)
 * - 존: 레벨 구간별 세계관 (정원·마을·항구·바다)
 * - 뱃지: 특정 레벨 달성 시만 획득하는 칭호
 */

// ── 존 정의 ──────────────────────────────
export const CHILD_ZONES = [
  { zone: '정원', emoji: '🌱', minLevel: 0, maxLevel: 4 },
  { zone: '마을', emoji: '🏘️', minLevel: 5, maxLevel: 8 },
  { zone: '항구', emoji: '⚓', minLevel: 9, maxLevel: 12 },
  { zone: '바다', emoji: '⛵', minLevel: 13, maxLevel: Infinity },
] as const

export type ChildZone = (typeof CHILD_ZONES)[number]

/** 레벨 → 현재 존 반환 */
export function getChildZone(level: number): ChildZone {
  return (
    CHILD_ZONES.find((z) => level >= z.minLevel && level <= z.maxLevel) ??
    CHILD_ZONES[CHILD_ZONES.length - 1]
  )
}

// ── 뱃지 정의 (특정 레벨 달성 시만) ──────
export const CHILD_BADGES = [
  { level: 1, badge: '새싹', emoji: '🌿' },
  { level: 5, badge: '저축왕', emoji: '💰' },
  { level: 8, badge: '사업가', emoji: '🏪' },
  { level: 10, badge: '탐험가', emoji: '🗺️' },
  { level: 12, badge: '선장', emoji: '⛵' },
] as const

export type ChildBadgeEntry = (typeof CHILD_BADGES)[number]

/** 레벨 → 뱃지 반환 (없으면 null) */
export function getChildBadge(level: number): ChildBadgeEntry | null {
  return CHILD_BADGES.find((b) => b.level === level) ?? null
}

/** 레벨 → 지금까지 획득한 뱃지 전체 반환 */
export function getChildEarnedBadges(level: number): ChildBadgeEntry[] {
  return CHILD_BADGES.filter((b) => b.level <= level)
}

/** 단계 이름 대체: 뱃지 칭호, 없으면 「레벨 N」 */
export function childGrowthStageLabel(level: number): string {
  return getChildBadge(level)?.badge ?? `레벨 ${level}`
}

// ── 부모 가이드 문구 (레벨별) ─────────────
export const PARENT_GUIDES: Record<number, string> = {
  0: '아이가 처음 앱을 시작했어요! 매일 미션을 함께 확인하며 습관의 씨앗을 심어주세요.',
  1: '칭찬 스티커가 열렸어요 🎉 스티커를 모두 채우면 받을 보상을 아이와 미리 약속해 보세요. 작은 약속이 큰 동기가 돼요!',
  2: '미션을 반복하며 생활 습관을 만들어가는 중이에요. 꾸준히 완료한 것 자체를 충분히 칭찬해 주세요!',
  3: '화분에 물을 주며 책임감을 기르고 있어요. 보상 없이도 돌보는 경험이 아이에게 소중한 습관이 돼요.',
  4: '이제 곧 마을로 넘어가요! 지금까지 쌓아온 미션 습관이 탄탄한 기초가 될 거예요.',
  5: '저금통이 열렸어요 💰 크레딧을 바로 쓸지, 저금통에 넣을지 아이 스스로 결정하게 해주세요. 작은 선택이 경제 습관의 시작이에요!',
  6: '저금통에 얼마나 모였는지 아이와 함께 확인해 보세요. 모은 크레딧으로 무엇을 할지 이야기 나눠보는 것도 좋은 경제 교육이에요.',
  7: '곧 보물상자가 열려요! 아이가 번 크레딧을 어떻게 쓸지 미리 이야기해 보세요.',
  8: '보물상자가 열렸어요 🎁 번 크레딧으로 영상·미니게임 이용권을 직접 구매할 수 있어요. 무엇을 살지 스스로 선택하는 경험을 충분히 해볼 수 있게 해주세요!',
  9: '항구에 도착했어요 ⚓ 정원과 마을을 지나 여기까지 온 아이를 충분히 칭찬해 주세요!',
  10: '그림일기 기능이 곧 열려요 🗺️ 아이가 오늘의 기분을 표정·모양·색깔로 표현하는 특별한 경험이 될 거예요. (향후 업데이트 예정)',
  11: '선장이 되기까지 조금만 더! 아이가 꾸준히 성장하고 있어요.',
  12: '선장이 됐어요 ⛵ 화분에서 키운 것을 팔아 크레딧을 버는 기능이 곧 추가돼요. (향후 업데이트 예정)',
}

/** 레벨 → 부모 가이드 문구 반환 */
export function getParentGuide(level: number): string | null {
  return PARENT_GUIDES[level] ?? null
}
