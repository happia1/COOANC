/**
 * 식물(나무) 성장 단계·종류·씨앗 구매 비용
 */

/** 성장 단계: 0(씨앗)~7(다 익은 열매) 8단계 */
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

/**
 * public 폴더명 매핑 — TREE_LIST id 와 디스크 폴더명이 다를 수 있음(예: blueberry → bluberry).
 * getStageImage / getSeedImage 는 6종 모두 `{PLANT_BASE}/{folder}/{stage}.png` 패턴을 씁니다.
 */
const PLANT_ASSET_FOLDER: Record<PlantTreeId, string> = {
  apple: 'apple',
  strawberry: 'strawberry',
  lemon: 'lemon',
  cherry: 'cherry',
  blueberry: 'bluberry',
  sunflower: 'sunflower',
}

export function plantAssetFolder(treeId: PlantTreeId): string {
  return PLANT_ASSET_FOLDER[treeId] ?? treeId
}

export const WATERING_CAN_EMPTY_SRC = `${PLANT_BASE}/200.png`
export const WATERING_CAN_FULL_SRC = `${PLANT_BASE}/300.png`

/** `{PLANT_BASE}/{treeId}/{stage}.png` — apple/0.png … sunflower/7.png */
export function getStageImage(treeId: PlantTreeId, stage: PlantStage): string {
  const folder = plantAssetFolder(treeId)
  return `${PLANT_BASE}/${folder}/${stage}.png`
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
}): boolean {
  if (!pot.hasChosenSeed) return true
  return pot.stage === 7 && pot.completed
}

export function getSeedImage(treeId: PlantTreeId): string {
  const folder = plantAssetFolder(treeId)
  return `${PLANT_BASE}/${folder}/seed.png`
}

export function getRewardImage(treeId: PlantTreeId): string {
  const folder = plantAssetFolder(treeId)
  return `${PLANT_BASE}/${folder}/${folder}.png`
}

/**
 * 씨앗 선택 카드 미리보기 — 폴더 내 과일명 PNG(apple.png 등).
 * 해바라기만 성장 0단계(해바라기씨) 이미지를 그대로 씁니다.
 */
export function getSeedSelectCardImage(treeId: PlantTreeId): string {
  if (treeId === 'sunflower') return getStageImage('sunflower', 0)
  return getRewardImage(treeId)
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

  if (stage < 7) {
    completed = false
  }

  if (stage === 7) {
    completed = true
    heartsUsed = 0
  }

  return { stage, heartsUsed, completed }
}
