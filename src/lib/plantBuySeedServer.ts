import type { SupabaseClient } from '@supabase/supabase-js'
import { readChildStatInt } from '@/lib/childCreditsSplit'
import { getInitialStageAfterSeed, type PlantTreeId } from '@/constants/plantTrees'

type StatsRow = {
  credits: unknown
  credits_piggy?: unknown
  credits_wallet?: unknown
  hearts: unknown
  pot_stage: unknown
  pot_hearts_used: unknown
  pot_completed: unknown | null
  pot_tree_id?: unknown
}

const SELECT_CANDIDATES = [
  'credits, credits_piggy, credits_wallet, hearts, pot_stage, pot_hearts_used, pot_completed, pot_tree_id',
  'credits, credits_piggy, credits_wallet, hearts, pot_stage, pot_hearts_used, pot_completed',
  'credits, hearts, pot_stage, pot_hearts_used, pot_completed',
] as const

function isMissingColumnError(code: string | undefined, message: string | undefined): boolean {
  return code === '42703' || /column/i.test(message ?? '')
}

/**
 * child_stats 조회 — 컬럼이 없는 DB(구버전)도 단계적으로 시도합니다.
 */
export async function loadChildStatsForSeed(
  db: SupabaseClient,
  childId: string,
): Promise<{ row: StatsRow | null; error: string | null }> {
  for (const fields of SELECT_CANDIDATES) {
    const { data, error } = await db
      .from('child_stats')
      .select(fields)
      .eq('child_id', childId)
      .maybeSingle()

    if (!error && data) {
      return { row: data as unknown as StatsRow, error: null }
    }
    if (error && !isMissingColumnError(error.code, error.message)) {
      return { row: null, error: error.message }
    }
  }
  return { row: null, error: '통계 행을 찾을 수 없어요' }
}

type SeedUpdatePatch = Record<string, unknown>

function buildSeedPatches(
  newCredits: number,
  piggy: number,
  treeId: PlantTreeId,
): SeedUpdatePatch[] {
  const updatedAt = new Date().toISOString()
  const withWallet = {
    credits: newCredits,
    credits_wallet: 0,
    credits_piggy: piggy,
    pot_stage: getInitialStageAfterSeed(treeId),
    pot_hearts_used: 0,
    pot_completed: false,
    pot_tree_id: treeId,
    updated_at: updatedAt,
  }
  const withWalletNoTree = { ...withWallet }
  delete withWalletNoTree.pot_tree_id

  const withWalletNoTime = { ...withWalletNoTree }
  delete withWalletNoTime.updated_at

  const minimalWithTree = {
    credits: newCredits,
    pot_stage: getInitialStageAfterSeed(treeId),
    pot_hearts_used: 0,
    pot_completed: false,
    pot_tree_id: treeId,
  }

  /** pot_tree_id 없는 패치는 제외 — 크레딧만 빠지고 나무는 안 바뀌는 문제 방지 */
  return [withWallet, withWalletNoTree, withWalletNoTime, minimalWithTree]
}

/**
 * 씨앗 구매 후 child_stats 갱신 — pot_tree_id·updated_at 없는 환경도 순차 시도합니다.
 */
export async function applySeedPurchaseUpdate(
  db: SupabaseClient,
  childId: string,
  newCredits: number,
  piggy: number,
  treeId: PlantTreeId,
): Promise<{ ok: boolean; error: string | null }> {
  const patches = buildSeedPatches(newCredits, piggy, treeId)

  for (const patch of patches) {
    const { data, error } = await db
      .from('child_stats')
      .update(patch)
      .eq('child_id', childId)
      .select('child_id')

    if (!error && data && data.length > 0) {
      return { ok: true, error: null }
    }
    if (error && !isMissingColumnError(error.code, error.message)) {
      return { ok: false, error: error.message }
    }
  }

  return { ok: false, error: 'child_stats 행이 갱신되지 않았어요' }
}

/**
 * 구매 이력 — 테이블이 없어도 씨앗 심기는 성공으로 처리합니다.
 */
export async function logSeedPurchaseSafe(
  db: SupabaseClient,
  childId: string,
  treeId: PlantTreeId,
  cost: number,
): Promise<void> {
  try {
    const { error } = await db.from('plant_seed_purchases').insert({
      child_id: childId,
      tree_id: treeId,
      credit_cost: cost,
    })
    if (error) {
      console.warn('[plant-buy-seed] purchase log skipped', error.message, error.code)
    }
  } catch (e) {
    console.warn('[plant-buy-seed] purchase log exception', e)
  }
}

export function readPiggyFromStatsRow(row: StatsRow): number {
  return readChildStatInt(row.credits_piggy)
}
