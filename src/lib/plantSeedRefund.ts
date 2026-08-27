import type { SupabaseClient } from '@supabase/supabase-js'
import { readChildStatInt } from '@/lib/childCreditsSplit'

/** 잔액이 그사이 바뀌었을 때 다시 읽어 시도하는 최대 횟수 */
const SEED_REFUND_CAS_MAX_ATTEMPTS = 5

export type PlantSeedPurchaseRow = {
  id: string
  tree_id: string
  credit_cost: number
  purchased_at: string
}

/**
 * 중복 씨앗 구매 환불 — 가장 최근 1건만 남기고 나머지 credit_cost 를 credits 에 되돌립니다.
 */
export async function refundDuplicatePlantSeedPurchases(
  db: SupabaseClient,
  childId: string,
): Promise<
  | {
      ok: true
      refundedCredits: number
      removedCount: number
      keptPurchaseId: string | null
      newCredits: number
    }
  | { ok: false; error: string }
> {
  const { data: purchases, error: listErr } = await db
    .from('plant_seed_purchases')
    .select('id, tree_id, credit_cost, purchased_at')
    .eq('child_id', childId)
    .order('purchased_at', { ascending: true })

  if (listErr) {
    if (listErr.code === '42P01' || /plant_seed_purchases/i.test(listErr.message ?? '')) {
      return { ok: false, error: '씨앗 구매 이력 테이블이 없어요. 마이그레이션 111을 적용해 주세요.' }
    }
    return { ok: false, error: listErr.message }
  }

  const rows = (purchases ?? []) as PlantSeedPurchaseRow[]
  if (rows.length <= 1) {
    const { data: stats } = await db.from('child_stats').select('credits').eq('child_id', childId).maybeSingle()
    return {
      ok: true,
      refundedCredits: 0,
      removedCount: 0,
      keptPurchaseId: rows[0]?.id ?? null,
      newCredits: readChildStatInt(stats?.credits),
    }
  }

  const kept = rows[rows.length - 1]
  const toRemove = rows.slice(0, -1)
  const refundedCredits = toRemove.reduce((sum, r) => sum + Math.max(0, readChildStatInt(r.credit_cost)), 0)
  const removeIds = toRemove.map((r) => r.id)

  /**
   * 환불도 **읽은 잔액 그대로일 때만** 더합니다(CAS). 그사이 값이 바뀌었으면 다시 읽어 재시도합니다.
   *
   * 비개발자 설명: 예전에는 "지금 잔액 + 환불액" 을 통째로 덮어썼습니다. 환불이 처리되는 사이에
   * 미션 보상이 들어오면 그 보상이 지워졌습니다. 이제는 겹쳐도 둘 다 남습니다.
   *
   * `credits_piggy` · `credits_wallet` 은 여기서 건드리지 않습니다 — 저금통을 바꾸는 곳은
   * 옮기기와 이자 정산뿐이어야 합니다.
   */
  let newCredits = 0
  let saved = false
  let lastErr: string | null = null

  for (let attempt = 0; attempt < SEED_REFUND_CAS_MAX_ATTEMPTS; attempt += 1) {
    const { data: stats, error: statsErr } = await db
      .from('child_stats')
      .select('credits')
      .eq('child_id', childId)
      .maybeSingle()

    if (statsErr || !stats) {
      return { ok: false, error: statsErr?.message ?? 'child_stats 를 찾을 수 없어요' }
    }

    const observed = readChildStatInt(stats.credits)
    newCredits = observed + refundedCredits

    const { data: updatedRows, error: upErr } = await db
      .from('child_stats')
      .update({ credits: newCredits })
      .eq('child_id', childId)
      /** 핵심: 읽은 잔액 그대로일 때만 저장 — 그사이 들어온 보상을 덮어쓰지 않음 */
      .eq('credits', observed)
      .select('child_id')

    if (upErr) {
      return { ok: false, error: upErr.message }
    }
    if (updatedRows && updatedRows.length > 0) {
      saved = true
      break
    }
    lastErr = '크레딧이 그사이 바뀌었어요'
  }

  if (!saved) {
    return { ok: false, error: lastErr ?? '환불 저장에 실패했어요' }
  }

  const { error: delErr } = await db.from('plant_seed_purchases').delete().in('id', removeIds)

  if (delErr) {
    return { ok: false, error: delErr.message }
  }

  return {
    ok: true,
    refundedCredits,
    removedCount: toRemove.length,
    keptPurchaseId: kept.id,
    newCredits,
  }
}
