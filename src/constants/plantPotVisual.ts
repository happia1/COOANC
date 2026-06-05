/**
 * 화분(식물) 그림 크기·위치 — 홈 버튼(56px)·팝업(112px) 공통 규칙
 *
 * 비개발자 설명:
 * - 사과·딸기·레몬 등 **모든 화분**이 홈에서 같은 위치(좌표)에 붙습니다.
 * - 사과만 0단계(씨앗) 그림이 더 작고, 나머지 과일은 1단계부터 같은 크기로 시작합니다.
 * - 단계가 올라갈수록 같은 기준점(아래 중앙)에서 점점 커집니다.
 * - 1단계는 2/3, 3·5·6·7단계는 고정 배율, 2·4단계는 그 사이 보간입니다.
 *
 * 개발·검수: `getPlantPotStageScale` / `getPlantPotScaleTable` 로 단계별 배율을 확인할 수 있습니다.
 */

import type { PlantStage, PlantTreeId } from '@/constants/plantTrees'
import { TREE_LIST, usesAppleStageZero } from '@/constants/plantTrees'

export type PlantPotSurface = 'home' | 'popup'

/** 1단계(pot_stage 1) 기준 배율 */
export const PLANT_POT_OTHER_FRUIT_STAGE1_SCALE = 2 / 3

/** 7단계 최대 배율 */
export const PLANT_POT_STAGE7_SCALE = 1.2

/** 사과 0단계(씨앗 심은 직후) 배율 */
export const PLANT_POT_APPLE_SEED_SCALE = 0.45

/**
 * 성장 단계(pot_stage 1~7)별 scale — 사과·딸기 등 공통(0단계 제외).
 * 2·4단계는 인접 고정값 사이 선형 보간.
 */
const PLANT_POT_GROWTH_SCALE_FIXED: Partial<Record<PlantStage, number>> = {
  1: PLANT_POT_OTHER_FRUIT_STAGE1_SCALE,
  3: 0.8,
  5: 0.92,
  6: 1.0,
  7: PLANT_POT_STAGE7_SCALE,
}

/** 레몬만 6·7단계를 더 크게 */
const LEMON_POT_SCALE_OVERRIDE: Partial<Record<PlantStage, number>> = {
  6: 1.2,
  7: 1.5,
}

/** 블루베리만 5단계 */
const BLUEBERRY_POT_SCALE_OVERRIDE: Partial<Record<PlantStage, number>> = {
  5: 0.97,
}

function lerpStageScale(fromStage: number, toStage: number, stage: number): number {
  const from = PLANT_POT_GROWTH_SCALE_FIXED[fromStage as PlantStage]
  const to = PLANT_POT_GROWTH_SCALE_FIXED[toStage as PlantStage]
  if (from == null || to == null) return PLANT_POT_OTHER_FRUIT_STAGE1_SCALE
  const t = (stage - fromStage) / (toStage - fromStage)
  return from + t * (to - from)
}

function scaleForGrowthPotStage(stage: PlantStage): number {
  const fixed = PLANT_POT_GROWTH_SCALE_FIXED[stage]
  if (fixed != null) return fixed
  if (stage === 2) return lerpStageScale(1, 3, 2)
  if (stage === 4) return lerpStageScale(3, 5, 4)
  return PLANT_POT_OTHER_FRUIT_STAGE1_SCALE
}

/** 자녀 홈 — 딸기·레몬 등(사과 제외) 화분 묶음 앵커 */
export const PLANT_POT_HOME_SHELL_TRANSFORM =
  'translate(-50%, calc(-88% - 22px))' as const

/** 사과나무 심은 뒤(0~7단계) — 홈 앵커만 별도 조정 */
const PLANT_POT_HOME_SHELL_TRANSFORM_APPLE =
  'translate(-50%, calc(-92% - 30px))' as const

/** 사과 0단계 — 화분 안 그림 위치(홈은 y를 줄여 전체가 덜 내려가 보이게) */
const APPLE_SEED_IMAGE_OFFSET_PX: Record<PlantPotSurface, { x: number; y: number }> = {
  home: { x: 0, y: 2 },
  popup: { x: 0, y: 5 },
}

/** 딸기·레몬·체리 1·2단계 — 그림자 때문에 왼쪽으로 밀려 보여 오른쪽으로 보정(px) */
const SHADOW_SHIFT_RIGHT_TREE_IDS: readonly PlantTreeId[] = [
  'strawberry',
  'lemon',
  'cherry',
]
const SHADOW_SHIFT_RIGHT_STAGES: readonly PlantStage[] = [1, 2]
const SHADOW_SHIFT_RIGHT_OFFSET_PX: Record<PlantPotSurface, number> = {
  home: 4,
  popup: 6,
}

/** 해바라기 3~7단계 — 공통 오른쪽 보정(px) */
const SUNFLOWER_SHIFT_RIGHT_OFFSET_PX: Record<PlantPotSurface, number> = {
  home: 5,
  popup: 8,
}

/** 해바라기 1·2단계 — 추가로 더 오른쪽(px) */
const SUNFLOWER_SHIFT_RIGHT_EARLY_OFFSET_PX: Record<PlantPotSurface, number> = {
  home: 10,
  popup: 14,
}

function isAppleSeedImage(treeId: PlantTreeId, stage: PlantStage): boolean {
  return usesAppleStageZero(treeId) && stage === 0
}

function getPlantPotImageOffset(
  treeId: PlantTreeId,
  stage: PlantStage,
  surface: PlantPotSurface,
): { x: number; y: number } {
  if (isAppleSeedImage(treeId, stage)) {
    return APPLE_SEED_IMAGE_OFFSET_PX[surface]
  }
  if (
    SHADOW_SHIFT_RIGHT_TREE_IDS.includes(treeId) &&
    SHADOW_SHIFT_RIGHT_STAGES.includes(stage)
  ) {
    return { x: SHADOW_SHIFT_RIGHT_OFFSET_PX[surface], y: 0 }
  }
  if (treeId === 'sunflower' && (stage === 1 || stage === 2)) {
    return { x: SUNFLOWER_SHIFT_RIGHT_EARLY_OFFSET_PX[surface], y: 0 }
  }
  if (treeId === 'sunflower' && stage >= 3 && stage <= 7) {
    return { x: SUNFLOWER_SHIFT_RIGHT_OFFSET_PX[surface], y: 0 }
  }
  return { x: 0, y: 0 }
}

export type PlantPotVisualStyle = {
  scale: number
  translateX: number
  translateY: number
  transformOrigin: string
}

/**
 * 자녀 홈 화분·물조리개 묶음 transform.
 * 첫 씨앗 선택 전(모종삽)·수확 후 재심기 미리보기는 공통 앵커.
 */
export function getPlantPotHomeShellTransform(
  treeId?: PlantTreeId,
  _stage?: PlantStage,
  useCommonHomeAnchor?: boolean,
): string {
  if (useCommonHomeAnchor) {
    return PLANT_POT_HOME_SHELL_TRANSFORM
  }
  if (treeId != null && usesAppleStageZero(treeId)) {
    return PLANT_POT_HOME_SHELL_TRANSFORM_APPLE
  }
  return PLANT_POT_HOME_SHELL_TRANSFORM
}

/** 단계별 scale — 사과 0단계·레몬 6~7단계만 예외, 나머지는 공통 표 */
export function getPlantPotStageScale(treeId: PlantTreeId, stage: PlantStage): number {
  if (usesAppleStageZero(treeId) && stage === 0) {
    return PLANT_POT_APPLE_SEED_SCALE
  }
  if (treeId === 'lemon') {
    const lemonScale = LEMON_POT_SCALE_OVERRIDE[stage]
    if (lemonScale != null) return lemonScale
  }
  if (treeId === 'blueberry') {
    const blueberryScale = BLUEBERRY_POT_SCALE_OVERRIDE[stage]
    if (blueberryScale != null) return blueberryScale
  }
  if (stage >= 1 && stage <= 7) {
    return scaleForGrowthPotStage(stage)
  }
  return PLANT_POT_OTHER_FRUIT_STAGE1_SCALE
}

/** 검수용 — 나무 종류별 pot_stage → scale 표 */
export function getPlantPotScaleTable(
  treeId: PlantTreeId,
): { stage: PlantStage; scale: number; displayStep: number }[] {
  const stages: PlantStage[] = usesAppleStageZero(treeId)
    ? [0, 1, 2, 3, 4, 5, 6, 7]
    : [1, 2, 3, 4, 5, 6, 7]
  return stages.map((stage) => ({
    stage,
    scale: getPlantPotStageScale(treeId, stage),
    displayStep: usesAppleStageZero(treeId) ? stage + 1 : stage,
  }))
}

/** 검수용 — 6종 모두 한 번에 */
export function getAllPlantPotScaleTables(): Record<
  PlantTreeId,
  ReturnType<typeof getPlantPotScaleTable>
> {
  return Object.fromEntries(
    TREE_LIST.map((t) => [t.id, getPlantPotScaleTable(t.id)]),
  ) as Record<PlantTreeId, ReturnType<typeof getPlantPotScaleTable>>
}

export type PlantPotVisualOptions = {
  /** 수확 후 재심기 등 사과 0 미리보기 — 홈에서 딸기 1단계와 같은 translate */
  matchStrawberryStage1Home?: boolean
}

/**
 * 모종삽 아이콘 — 씨앗 미선택 때 보이던 화분(사과 0·딸기 1단계 정렬)과 동일 좌표.
 */
export function getPlantShovelHomeVisualStyle(): PlantPotVisualStyle {
  return getPlantPotVisualStyle('apple', 0, 'home', { matchStrawberryStage1Home: true })
}

/** 화분 안 식물 PNG — 단계별 scale + 나무별·단계별 translate */
export function getPlantPotVisualStyle(
  treeId: PlantTreeId,
  stage: PlantStage,
  surface: PlantPotSurface,
  options?: PlantPotVisualOptions,
): PlantPotVisualStyle {
  const scale = getPlantPotStageScale(treeId, stage)
  const offset =
    options?.matchStrawberryStage1Home && surface === 'home'
      ? { x: SHADOW_SHIFT_RIGHT_OFFSET_PX.home, y: 0 }
      : getPlantPotImageOffset(treeId, stage, surface)
  return {
    scale,
    translateX: offset.x,
    translateY: offset.y,
    transformOrigin: 'center bottom',
  }
}
