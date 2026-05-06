/**
 * 식물(나무) 성장 단계 상수 — MVP 에서는 사과나무만 사용합니다.
 */

/** 성장 단계: 0(씨앗)~7(다 익은 열매) 8단계 */
export type PlantStage = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

export type PlantTreeId = 'apple'

export const STAGE_LABELS: Record<PlantStage, string> = {
  0: '씨앗',
  1: '새싹',
  2: '어린나무',
  3: '꽃봉오리',
  4: '꽃핌',
  5: '작은 열매',
  6: '익어가는 열매',
  7: '다 익은 열매',
}

/**
 * 물 주기로 단계가 1단계 오를 때마다 팝업에 보여 줄 짧은 축하 문구(도달한 단계 번호 기준).
 * 비개발자: 씨앗(0)에서는 팝업을 쓰지 않고, 1부터 7까지 각각 다른 문장을 띄웁니다.
 */
const CELEBRATION_BY_STAGE: Partial<Record<PlantStage, string>> = {
  1: '싹이 나왔어요!',
  2: '어린 나무가 되었어요!',
  3: '꽃봉오리가 생겼어요!',
  4: '예쁜 꽃이 폈어요!',
  5: '작은 열매가 맺혔어요!',
  6: '열매가 빨개지고 있어요!',
  7: '사과가 다 익었어요!',
}

/** 축하 팝업 메인 카피 — 알 수 없는 단계면 보수적 한 줄 */
export function getPlantStageCelebrationTitle(stage: PlantStage): string {
  return CELEBRATION_BY_STAGE[stage] ?? '식물이 한 단계 자랐어요!'
}

/** 이미지 경로 — /public/assets/img/missions/routine/plant/ */
const PLANT_BASE = '/assets/img/missions/routine/plant'

/** 단계별 식물 일러스트(`PlantPot` 등에서 사용) */
export const STAGE_IMAGE: Record<PlantStage, string> = {
  0: `${PLANT_BASE}/0.png`,
  1: `${PLANT_BASE}/1.png`,
  2: `${PLANT_BASE}/2.png`,
  3: `${PLANT_BASE}/3.png`,
  4: `${PLANT_BASE}/4.png`,
  5: `${PLANT_BASE}/5.png`,
  6: `${PLANT_BASE}/6.png`,
  7: `${PLANT_BASE}/7.png`,
}

/**
 * 물조리개 이미지 — 보유 하트 수에 따라 3단계
 * 0~99: 100.png (비어있는 느낌)
 * 100~199: 200.png (중간)
 * 200+: 300.png (꽉 찬 느낌)
 */
export function getWateringCanImage(hearts: number): string {
  if (hearts >= 200) return `${PLANT_BASE}/300.png`
  if (hearts >= 100) return `${PLANT_BASE}/200.png`
  return `${PLANT_BASE}/100.png`
}

/** 완성 팝업 등에 쓸 사과 이미지 */
export const APPLE_REWARD_IMAGE = `${PLANT_BASE}/apple.png`
/** 씨앗 선택 등에 쓸 씨앗 이미지 */
export const SEED_IMAGE = `${PLANT_BASE}/seed.png`

/**
 * 단계 → 다음 단계까지 필요한 하트 수
 * 7단계(완성)는 다음이 없으므로 0
 */
export const HEARTS_PER_STAGE: Record<PlantStage, number> = {
  0: 3, // 씨앗 → 새싹
  1: 5, // 새싹 → 어린나무
  2: 8, // 어린나무 → 꽃봉오리
  3: 10, // 꽃봉오리 → 꽃핌
  4: 15, // 꽃핌 → 작은 열매
  5: 20, // 작은 열매 → 익어가는 열매
  6: 25, // 익어가는 열매 → 다 익은 열매
  7: 0, // 완성 (자동 리셋 대기)
}

export type PlantTreeDefinition = {
  id: PlantTreeId
  label: string
  seedEmoji: string
}

export const TREE_LIST: PlantTreeDefinition[] = [{ id: 'apple', label: '사과나무', seedEmoji: '🍎' }]

/** 알 수 없는 코드가 오면 apple 반환 */
export function resolveTreeId(id: string | null | undefined): PlantTreeId {
  if (id === 'apple') return 'apple'
  return 'apple'
}
