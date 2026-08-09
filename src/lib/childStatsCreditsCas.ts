import type { SupabaseClient } from '@supabase/supabase-js'
import { readChildStatInt } from '@/lib/childCreditsSplit'

/**
 * `child_stats` 의 크레딧 계열 값을 **안전하게** 바꾸는 공용 도구.
 *
 * 왜 필요한가(비개발자 설명):
 *   예전에는 "지금 잔액을 읽고 → 계산해서 → 그 숫자로 통째로 덮어쓰기" 방식이었습니다.
 *   읽고 나서 덮어쓰기까지 사이에 다른 처리(미션 보상, 저금통 옮기기, 결제 등)가 먼저 저장되면,
 *   그 결과가 옛 계산값에 지워져 크레딧이 사라지거나 숫자가 튀었습니다.
 *
 *   이제는 "내가 읽은 그 값 그대로일 때만 바꾼다"(낙관적 동시성 제어, CAS)로 처리합니다.
 *   그사이 값이 바뀌었으면 아무것도 안 바뀌므로, 최신 값을 다시 읽어 재시도합니다.
 *   → 어떤 순서로 겹쳐 들어와도 서로의 결과를 덮어쓰지 않습니다.
 */

/** 잔액 경합으로 재시도하는 최대 횟수 */
export const CREDITS_CAS_MAX_ATTEMPTS = 5

/** CAS 로 읽고 쓰는 크레딧 계열 값 */
export type ChildCreditsSnapshot = {
  credits: number
  piggy: number
  hearts: number
  /** 레벨도 같이 읽어 둡니다 — 레벨 확인 때문에 따로 한 번 더 조회하지 않으려고 */
  level: number
}

export type CreditsCasResult =
  | { ok: true; credits: number; piggy: number; hearts: number }
  | { ok: false; reason: 'rejected'; message: string; current: ChildCreditsSnapshot }
  | { ok: false; reason: 'conflict' | 'db' }

/**
 * `compute` 가 현재 잔액을 보고 다음 값을 정하면, 그 값이 그대로일 때만 저장합니다.
 * - `compute` 가 `{ ok: false, message }` 를 돌려주면 저장하지 않고 그 사유를 그대로 반환합니다.
 *   (예: "크레딧이 부족해요")
 * - 저장 직전에 값이 바뀌었으면 최신 값으로 `compute` 를 다시 불러 재시도합니다.
 */
export async function applyChildCreditsCas(
  supabase: SupabaseClient,
  childId: string,
  compute: (
    current: ChildCreditsSnapshot,
  ) =>
    | { ok: true; credits?: number; piggy?: number; hearts?: number }
    | { ok: false; message: string },
  options?: { extraPatch?: Record<string, unknown> },
): Promise<CreditsCasResult> {
  for (let attempt = 0; attempt < CREDITS_CAS_MAX_ATTEMPTS; attempt += 1) {
    const { data: row, error: readErr } = await supabase
      .from('child_stats')
      .select('credits, credits_piggy, hearts, current_level')
      .eq('child_id', childId)
      .maybeSingle()

    if (readErr || !row) return { ok: false as const, reason: 'db' as const }

    const current: ChildCreditsSnapshot = {
      credits: readChildStatInt(row.credits),
      piggy: readChildStatInt(row.credits_piggy),
      hearts: readChildStatInt(row.hearts),
      level: readChildStatInt(row.current_level),
    }

    const decided = compute(current)
    if (decided.ok === false) {
      return { ok: false as const, reason: 'rejected' as const, message: decided.message, current }
    }

    const nextCredits = decided.credits ?? current.credits
    const nextPiggy = decided.piggy ?? current.piggy
    const nextHearts = decided.hearts ?? current.hearts

    const patch: Record<string, unknown> = {
      credits: nextCredits,
      credits_wallet: 0,
      credits_piggy: nextPiggy,
      hearts: nextHearts,
      /** Realtime 이벤트 순서를 화면이 판별할 수 있도록 매번 갱신합니다 */
      updated_at: new Date().toISOString(),
      ...(options?.extraPatch ?? {}),
    }

    const { data: updated, error: updErr } = await supabase
      .from('child_stats')
      .update(patch)
      .eq('child_id', childId)
      /** 핵심: 읽은 값 그대로일 때만 저장 — 그사이 들어온 다른 변경을 덮어쓰지 않음 */
      .eq('credits', current.credits)
      .eq('credits_piggy', current.piggy)
      .eq('hearts', current.hearts)
      .select('credits')

    if (updErr) {
      console.error('[childStatsCreditsCas] update', updErr.message)
      return { ok: false as const, reason: 'db' as const }
    }
    if (updated && updated.length > 0) {
      return { ok: true as const, credits: nextCredits, piggy: nextPiggy, hearts: nextHearts }
    }
    /** 경합 — 최신 값으로 다시 계산해 재시도 */
  }

  return { ok: false as const, reason: 'conflict' as const }
}
