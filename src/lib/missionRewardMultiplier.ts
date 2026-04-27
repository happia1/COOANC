/**
 * missions.reward_multiplier — 스페셜 보너스(2배·3배)를 완료 보상에 곱할 때 사용합니다.
 * DB에 컬럼이 없거나 잘못된 값이면 1배로 취급합니다.
 *
 * ━━ 앱 전체 표시 규칙(부모·자녀) ━━
 * - 미션 카드·팝업에 찍는 보상 **숫자**는 **항상** `scaledMissionRewards(미션)` 결과만 씁니다.
 *   (부모 루틴, 자녀 미션 탭 — `MissionRewardIconTriple` 는 카드에 크레딧·하트만 표시, exp 는 API·레벨용)
 * - 자녀/부모 **프로필의 크레딧·하트(보유 총액)** 는 `child_stats` 한 줄이 기준이며, 미션 칸의 숫자는
 *   「그 판(미션)을 끝냈을 때 더해지는 양」입니다(서로 다른 항목).
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
