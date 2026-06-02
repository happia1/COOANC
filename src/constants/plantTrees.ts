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

/** 이미지 루트 — /public/assets/img/missions/routine/plant/ */
export const PLANT_BASE = '/assets/img/missions/routine/plant'

/**
 * 화분 팝업 도구 — 물조리개 이미지는 plant 루트의 200/300.png 를 씁니다.
 */

/** 물조리개 — 하트 없음(빈) / 하트 있음(채움) */
export const WATERING_CAN_EMPTY_SRC = `${PLANT_BASE}/200.png`
export const WATERING_CAN_FULL_SRC = `${PLANT_BASE}/300.png`

/** 나무 종류별 단계 일러스트 — `apple/0.png` … `apple/7.png` 형식 */
export function getStageImage(treeId: PlantTreeId, stage: PlantStage): string {
  return `${PLANT_BASE}/${treeId}/${stage}.png`
}

/** 나무 종류별 씨앗 그림 */
export function getSeedImage(treeId: PlantTreeId): string {
  return `${PLANT_BASE}/${treeId}/seed.png`
}

/** 완성 보상·열매 그림 — 사과나무는 `apple.png`, 그 외는 7단계 그림 */
export function getRewardImage(treeId: PlantTreeId): string {
  if (treeId === 'apple') return `${PLANT_BASE}/apple/apple.png`
  return `${PLANT_BASE}/${treeId}/7.png`
}

/**
 * @deprecated `getStageImage(treeId, stage)` 사용 — 사과나무 기본값만 유지
 */
export const STAGE_IMAGE: Record<PlantStage, string> = {
  0: getStageImage('apple', 0),
  1: getStageImage('apple', 1),
  2: getStageImage('apple', 2),
  3: getStageImage('apple', 3),
  4: getStageImage('apple', 4),
  5: getStageImage('apple', 5),
  6: getStageImage('apple', 6),
  7: getStageImage('apple', 7),
}

/** @deprecated `getRewardImage('apple')` 사용 */
export const APPLE_REWARD_IMAGE = getRewardImage('apple')
/** @deprecated `getSeedImage(treeId)` 사용 */
export const SEED_IMAGE = getSeedImage('apple')

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

/**
 * DB 의 `pot_stage` / `pot_hearts_used` 가 어긋날 때(한쪽만 반영된 경우) 보정합니다.
 * 비개발자: 막대는 꽉 찼는데 단계 숫자가 안 올라가는 것처럼 보이면, 쌓인 하트만큼 단계를 몇 칸 올려 맞춥니다.
 */
export function normalizePlantPotProgress(
  stageRaw: number,
  heartsUsedRaw: number,
  completedRaw: boolean,
): { stage: PlantStage; heartsUsed: number; completed: boolean } {
  let stage = Math.min(7, Math.max(0, Math.trunc(Number(stageRaw)) || 0)) as PlantStage
  let heartsUsed = Math.max(0, Math.trunc(Number(heartsUsedRaw)) || 0)
  let completed = Boolean(completedRaw)

  while (stage < 7) {
    const needed = HEARTS_PER_STAGE[stage]
    if (needed <= 0) break
    if (heartsUsed < needed) break
    heartsUsed -= needed
    stage = Math.min(7, stage + 1) as PlantStage
  }

  /**
   * 완성(열매) 플래그는 **7단계에서만** true 입니다.
   * DB 에 잘못 저장된 `pot_completed`(예: 5단계인데 true)가 있으면
   * 예전 서버가 `stage === 7 || completed` 로 분기할 때 **항상 씨앗 리셋**만 하려 해
   * 물주기·막대가 멈춘 것처럼 보일 수 있어, 7단계가 아니면 여기서 false 로 맞춥니다.
   */
  if (stage < 7) {
    completed = false
  }

  if (stage === 7) {
    completed = true
    heartsUsed = 0
  }

  return { stage, heartsUsed, completed }
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
