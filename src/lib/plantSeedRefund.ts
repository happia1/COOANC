import type { SupabaseClient } from '@supabase/supabase-js'
import { readChildStatInt } from '@/lib/childCreditsSplit'

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

  const { data: stats, error: statsErr } = await db
    .from('child_stats')
    .select('credits, credits_piggy, credits_wallet')
    .eq('child_id', childId)
    .maybeSingle()

  if (statsErr || !stats) {
    return { ok: false, error: statsErr?.message ?? 'child_stats 를 찾을 수 없어요' }
  }

  const newCredits = readChildStatInt(stats.credits) + refundedCredits
  const piggy = readChildStatInt(stats.credits_piggy)

  const { error: upErr } = await db
    .from('child_stats')
    .update({
      credits: newCredits,
      credits_wallet: 0,
      credits_piggy: piggy,
    })
    .eq('child_id', childId)

  if (upErr) {
    return { ok: false, error: upErr.message }
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
