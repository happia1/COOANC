/**
 * 식물(나무) 성장 단계·종류·씨앗 구매 비용
 */

/**
 * DB `pot_stage` 값 — 사과만 0(씨앗)~7, 나머지 과일은 1~7(에셋 1.png~7.png).
 * 7단계에서 다 익으면 수확·이후 재심기.
 */
export type PlantStage = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

export const TREE_LIST = [
  { id: 'apple', name: '사과나무', emoji: '🍎', creditCost: 10 },
  { id: 'strawberry', name: '딸기', emoji: '🍓', creditCost: 30 },
  { id: 'lemon', name: '레몬', emoji: '🍋', creditCost: 50 },
  { id: 'cherry', name: '체리', emoji: '🍒', creditCost: 80 },
  { id: 'blueberry', name: '블루베리', emoji: '🫐', creditCost: 100 },
  { id: 'sunflower', name: '해바라기', emoji: '🌻', creditCost: 150 },
] as const

export type PlantTreeId = (typeof TREE_LIST)[number]['id']

export type PlantTreeDefinition = (typeof TREE_LIST)[number]

/** 알 수 없는 코드 → apple */
export function resolveTreeId(id: string | null | undefined): PlantTreeId {
  const hit = TREE_LIST.find((t) => t.id === id)
  return hit?.id ?? 'apple'
}

export function getPlantTree(id: PlantTreeId): PlantTreeDefinition {
  return TREE_LIST.find((t) => t.id === id) ?? TREE_LIST[0]
}

export function getPlantTreeCreditCost(id: PlantTreeId): number {
  return getPlantTree(id).creditCost
}

/** 수확 메시지·인벤토리에 쓰는 과일 이름 */
export const HARVEST_FRUIT_NAME: Record<PlantTreeId, string> = {
  apple: '사과',
  strawberry: '딸기',
  lemon: '레몬',
  cherry: '체리',
  blueberry: '블루베리',
  sunflower: '해바라기',
}

export function getHarvestFruitName(treeId: PlantTreeId): string {
  return HARVEST_FRUIT_NAME[treeId] ?? HARVEST_FRUIT_NAME.apple
}

/** 완성 수확량 1~5개 (서버·클라이언트 동일 규칙) */
export function randomHarvestAmount(): number {
  return 1 + Math.floor(Math.random() * 5)
}

/** 임시 과일 바구니 아이콘 — 추후 전용 에셋으로 교체 예정 */
export const PLANT_HARVEST_BASKET_ICON_SRC = '/assets/img/common/ui/basket_filled.png'

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

const CELEBRATION_BY_STAGE: Partial<Record<PlantStage, string>> = {
  1: '싹이 나왔어요!',
  2: '어린 나무가 되었어요!',
  3: '꽃봉오리가 생겼어요!',
  4: '예쁜 꽃이 폈어요!',
  5: '작은 열매가 맺혔어요!',
  6: '열매가 빨개지고 있어요!',
  7: '열매가 다 익었어요!',
}

export function getPlantStageCelebrationTitle(stage: PlantStage): string {
  return CELEBRATION_BY_STAGE[stage] ?? '식물이 한 단계 자랐어요!'
}

/** 이미지 루트 — /public/assets/img/missions/routine/plant/ */
export const PLANT_BASE = '/assets/img/missions/routine/plant'

/** 사과만 0단계(씨앗 심은 화분)부터 성장, 그 외는 1단계 그림부터 */
export function usesAppleStageZero(treeId: PlantTreeId): boolean {
  return treeId === 'apple'
}

/** 이 나무의 성장 `pot_stage` 최솟값 */
export function getMinGrowthStage(treeId: PlantTreeId): PlantStage {
  return usesAppleStageZero(treeId) ? 0 : 1
}

/** 씨앗 구매 직후 DB에 넣을 첫 단계 */
export function getInitialStageAfterSeed(treeId: PlantTreeId): PlantStage {
  return getMinGrowthStage(treeId)
}

/**
 * 화면에 보여 줄 「N단계」 번호 — 사과는 0→1번째, 나머지는 stage 그대로 1~7.
 */
export function getDisplayStepIndex(treeId: PlantTreeId, stage: PlantStage): number {
  return usesAppleStageZero(treeId) ? stage + 1 : Math.max(1, stage)
}

/**
 * public 폴더명 — TREE_LIST id 와 디스크 폴더명이 다를 수 있음(blueberry → bluberry).
 */
const PLANT_ASSET_FOLDER: Record<PlantTreeId, string> = {
  apple: 'apple',
  strawberry: 'strawberry',
  lemon: 'lemon',
  cherry: 'cherry',
  blueberry: 'bluberry',
  sunflower: 'sunflower',
}

/**
 * 과일별 에셋 (public/assets/img/missions/routine/plant/)
 * - apple: pot_stage 0~7 → 0.png~7.png
 * - 그 외: pot_stage 1~7 → 1.png~7.png (0.png 미사용)
 * - 미선택 안내·씨앗 카드는 과일명 PNG 또는 apple 0.png
 */
const FRUIT_ICON_FILENAME: Record<PlantTreeId, string> = {
  apple: 'apple.png',
  strawberry: 'strawberry.png',
  lemon: 'lemon.png',
  cherry: 'cherry.png',
  blueberry: 'bluberry.png',
  sunflower: '0.png',
}

/** 완성(7단계) 축하·수확 — 대부분 과일명 PNG, 해바라기만 7단계 그림 */
const HARVEST_IMAGE_FILENAME: Record<PlantTreeId, string> = {
  apple: 'apple.png',
  strawberry: 'strawberry.png',
  lemon: 'lemon.png',
  cherry: 'cherry.png',
  blueberry: 'bluberry.png',
  sunflower: '7.png',
}

export function plantAssetFolder(treeId: PlantTreeId): string {
  return PLANT_ASSET_FOLDER[treeId] ?? treeId
}

function plantAssetSrc(folder: string, filename: string): string {
  return `${PLANT_BASE}/${folder}/${filename}`
}

export const WATERING_CAN_EMPTY_SRC = `${PLANT_BASE}/200.png`
export const WATERING_CAN_FULL_SRC = `${PLANT_BASE}/300.png`

/** 화분·성장 단계 그림 — `pot_stage` 와 PNG 번호를 맞춥니다 */
export function getStageImage(treeId: PlantTreeId, stage: PlantStage): string {
  const folder = plantAssetFolder(treeId)
  if (usesAppleStageZero(treeId) && stage === 0) {
    return plantAssetSrc(folder, '0.png')
  }
  const imageStage = Math.max(getMinGrowthStage(treeId), stage) as PlantStage
  return plantAssetSrc(folder, `${imageStage}.png`)
}

/**
 * @deprecated `needsPotSeedSelection` 사용 — DB 기본값만으로는 미선택을 구분할 수 없음
 */
export function isPotAwaitingSeed(pot: {
  stage: PlantStage
  heartsUsed: number
  completed: boolean
}): boolean {
  return pot.stage === 0 && pot.heartsUsed === 0 && !pot.completed
}

/**
 * 씨앗 카드로 고르기 전·수확 후 재심기 전 — 홈에는 사과 0단계만, 팝업에는 물조리개 없음
 */
export function needsPotSeedSelection(pot: {
  hasChosenSeed: boolean
  stage: PlantStage
  completed: boolean
  treeId: PlantTreeId
}): boolean {
  if (!pot.hasChosenSeed) return true
  if (pot.stage === 7 && pot.completed) return true
  /** 수확 후 화분 비우기(7단계 물주기)로 pot_stage 0이 된 경우 — 사과 외는 1부터 다시 심기 */
  if (pot.hasChosenSeed && pot.stage < getMinGrowthStage(pot.treeId)) return true
  return false
}

export function getSeedImage(treeId: PlantTreeId): string {
  const folder = plantAssetFolder(treeId)
  const seedFile = treeId === 'apple' ? 'seed.png' : FRUIT_ICON_FILENAME[treeId]
  return plantAssetSrc(folder, seedFile)
}

/** 완성 수확·축하 팝업 큰 그림 */
export function getRewardImage(treeId: PlantTreeId): string {
  const folder = plantAssetFolder(treeId)
  return plantAssetSrc(folder, HARVEST_IMAGE_FILENAME[treeId])
}

/** 씨앗 선택 카드 미리보기 */
export function getSeedSelectCardImage(treeId: PlantTreeId): string {
  const folder = plantAssetFolder(treeId)
  return plantAssetSrc(folder, FRUIT_ICON_FILENAME[treeId])
}

/** @deprecated `getStageImage('apple', stage)` 사용 */
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

export const HEARTS_PER_STAGE: Record<PlantStage, number> = {
  0: 3,
  1: 5,
  2: 8,
  3: 10,
  4: 15,
  5: 20,
  6: 25,
  7: 0,
}

/** 현재 나무·단계에서 다음 단계로 가는 데 필요한 하트 수 */
export function getHeartsNeededForStage(treeId: PlantTreeId, stage: PlantStage): number {
  if (stage >= 7) return 0
  if (!usesAppleStageZero(treeId) && stage < 1) return 0
  return HEARTS_PER_STAGE[stage]
}

/** DB `pot_stage` 를 0~7 범위로만 맞춥니다(사과 외 0 = 수확 후 씨앗 고르기 대기). */
export function clampPotStageForTree(_treeId: PlantTreeId, stageRaw: number): PlantStage {
  const n = Number.isFinite(Number(stageRaw)) ? Math.trunc(Number(stageRaw)) : 0
  return Math.min(7, Math.max(0, n)) as PlantStage
}

export function normalizePlantPotProgress(
  stageRaw: number,
  heartsUsedRaw: number,
  completedRaw: boolean,
  treeId: PlantTreeId = 'apple',
): { stage: PlantStage; heartsUsed: number; completed: boolean } {
  let stage = clampPotStageForTree(treeId, stageRaw)
  let heartsUsed = Math.max(0, Math.trunc(Number(heartsUsedRaw)) || 0)
  let completed = Boolean(completedRaw)

  /** 예전 DB에 딸기 등이 stage 0 으로 저장된 경우만 1단계로 올립니다 */
  if (!usesAppleStageZero(treeId) && stage === 0 && (heartsUsed > 0 || completed)) {
    stage = 1
  }

  while (stage < 7) {
    if (!usesAppleStageZero(treeId) && stage === 0) break
    const needed = getHeartsNeededForStage(treeId, stage)
    if (needed <= 0) break
    if (heartsUsed < needed) break
    heartsUsed -= needed
    stage = Math.min(7, stage + 1) as PlantStage
  }

  if (stage < 7) {
    completed = false
  }

  if (stage === 7) {
    completed = true
    heartsUsed = 0
  }

  return { stage, heartsUsed, completed }
}
