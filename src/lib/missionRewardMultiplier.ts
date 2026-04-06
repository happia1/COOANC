/**
 * missions.reward_multiplier — 스페셜 보너스(2배·3배)를 완료 보상에 곱할 때 사용합니다.
 * DB에 컬럼이 없거나 잘못된 값이면 1배로 취급합니다.
 */

import type { Mission } from '@/types/database'

/** 허용 배율: 1(기본) · 2배 · 3배 */
export type RewardMultiplier = 1 | 2 | 3

export function normalizeRewardMultiplier(raw: unknown): RewardMultiplier {
  const n = Math.floor(Number(raw))
  if (n === 2) return 2
  if (n === 3) return 3
  return 1
}

type MissionRewards = Pick<Mission, 'credit_reward' | 'heart_reward' | 'exp_reward'> & {
  reward_multiplier?: number | null
}

/** 템플릿 기본 보상 × 배율 — 자녀 화면 표시·완료 API에서 동일하게 씁니다. */
export function scaledMissionRewards(m: MissionRewards): {
  credit: number
  heart: number
  exp: number
  mult: RewardMultiplier
} {
  const mult = normalizeRewardMultiplier(m.reward_multiplier)
  return {
    credit: m.credit_reward * mult,
    heart: m.heart_reward * mult,
    exp: m.exp_reward * mult,
    mult,
  }
}
