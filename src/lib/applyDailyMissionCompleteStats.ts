/**
 * /api/daily-mission/complete 가 성공했을 때 내려주는 JSON 으로
 * 화면의 child_stats(크레딧·하트·EXP·스트릭)를 서버와 같은 값으로 맞춥니다.
 *
 * 비개발자: 자녀가 미션을 끝낸 직후, 부모 앱/DB에 저장된 숫자와
 * 자녀 화면 상단 숫자가 어긋나지 않게 합니다(새로고침 전에도 동일).
 */

import { normalizeChildStatsCreditsSplit } from '@/lib/childCreditsSplit'
import type { ChildStats } from '@/types/database'

/** complete API 200 JSON — 필수만 타입(추가 필드는 무시) */
export type DailyMissionCompleteStatsPayload = {
  newCredits: number
  newHearts: number
  newLevel: number
  newExp: number
  newExpToNext: number
  newStreak: number
  totalCreditsEarned: number
}

export function nextChildStatsAfterMissionComplete(
  prev: ChildStats,
  payload: DailyMissionCompleteStatsPayload,
): ChildStats {
  return normalizeChildStatsCreditsSplit({
    ...prev,
    credits: payload.newCredits,
    hearts: payload.newHearts,
    current_level: payload.newLevel,
    exp: payload.newExp,
    exp_to_next_level: payload.newExpToNext,
    streak_days: payload.newStreak,
    total_credits_earned: payload.totalCreditsEarned,
  } as ChildStats)
}

/**
 * API 응답에 stats 블록이 있으면 적용, 없으면 null (구버전 호환).
 * 부모/클라이언트가 느슨한 JSON 을 쓸 수 있으므로 필드 검사를 합니다.
 */
export function tryApplyCompletePayload(
  prev: ChildStats | null,
  json: unknown,
): ChildStats | null {
  if (!prev || !json || typeof json !== 'object') return null
  const o = json as Record<string, unknown>
  if (
    typeof o.newCredits !== 'number' ||
    typeof o.newHearts !== 'number' ||
    typeof o.newLevel !== 'number' ||
    typeof o.newExp !== 'number' ||
    typeof o.newExpToNext !== 'number' ||
    typeof o.newStreak !== 'number' ||
    typeof o.totalCreditsEarned !== 'number'
  ) {
    return null
  }
  return nextChildStatsAfterMissionComplete(prev, {
    newCredits: o.newCredits,
    newHearts: o.newHearts,
    newLevel: o.newLevel,
    newExp: o.newExp,
    newExpToNext: o.newExpToNext,
    newStreak: o.newStreak,
    totalCreditsEarned: o.totalCreditsEarned,
  })
}
