import { MISSION_CREDITS_STAGE_CAP } from '@/constants/piggyBankStages'

/** 저금통·돈바구니(가용) 그림이 커지기 시작하는 크레딧 하한 */
const CREDITS_VISUAL_GROWTH_START = 850

/** 저금통만: 이 크레딧 이하에서는 아래 배율로 고정(그 위~849 까지는 850 근처로 갈수록 1에 가깝게 보간). */
const PIGGY_PRE_GROWTH_VISUAL_FLOOR_CREDITS = 800 as const

/**
 * 800 크레딧 근처에서의 저금통 추가 축소 배율(850 근처는 1에 수렴).
 * (돈바구니 `FloatingCreditsStackVisual` 은 건드리지 않음 — 저금통 전용.)
 */
/** 800 이하 저금통 배율 — 숫자를 낮출수록 850 대비 더 작아 보임(이전 0.86) */
const PIGGY_MUL_AT_OR_BELOW_PRE_GROWTH_FLOOR = 0.81 as const

/**
 * 850 미만·저금통 전용: 800 이하일 때 `PIGGY_MUL_AT_OR_BELOW_PRE_GROWTH_FLOOR`, 801~849 는 850 직전까지 선형으로 1에 가깝게 복구.
 */
export function piggyPre850VisualScaleMul(credits: number | undefined): number {
  if (credits == null) return 1
  const c = Math.floor(credits)
  if (c >= CREDITS_VISUAL_GROWTH_START) return 1
  if (c <= PIGGY_PRE_GROWTH_VISUAL_FLOOR_CREDITS) return PIGGY_MUL_AT_OR_BELOW_PRE_GROWTH_FLOOR
  const span = CREDITS_VISUAL_GROWTH_START - PIGGY_PRE_GROWTH_VISUAL_FLOOR_CREDITS
  const u = (c - PIGGY_PRE_GROWTH_VISUAL_FLOOR_CREDITS) / span
  return PIGGY_MUL_AT_OR_BELOW_PRE_GROWTH_FLOOR + u * (1 - PIGGY_MUL_AT_OR_BELOW_PRE_GROWTH_FLOOR)
}

/**
 * 850 ~ 캡: 900에서 이미 크게, 캡에서 최대.
 * 저금통(`PiggyBankStageVisual`)·돈바구니(`FloatingCreditsStackVisual`)가 같은 체감을 쓰도록 공통 함수입니다.
 */
export function missionCreditsProgressiveScaleMul(credits: number | undefined): number {
  if (credits == null || credits < CREDITS_VISUAL_GROWTH_START) return 1
  const cap = MISSION_CREDITS_STAGE_CAP
  const c = Math.min(Math.max(0, Math.floor(credits)), cap)

  /** 900 크레딧·캡에서의 최대 시각 배율(이전 1.36 / 1.78 에서 추가 축소) */
  const MUL_AT_900 = 1.03
  const MUL_AT_CAP = 1.08

  if (c <= 900) {
    const spanA = 900 - CREDITS_VISUAL_GROWTH_START
    const u = Math.min(1, Math.max(0, (c - CREDITS_VISUAL_GROWTH_START) / spanA))
    return 1 + u * (MUL_AT_900 - 1)
  }
  const spanB = Math.max(1, cap - 900)
  const u = Math.min(1, Math.max(0, (c - 900) / spanB))
  return MUL_AT_900 + u * (MUL_AT_CAP - MUL_AT_900)
}
