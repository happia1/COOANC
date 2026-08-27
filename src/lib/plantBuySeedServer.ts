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

/** 잔액이 그사이 바뀌었을 때 다시 계산해 시도하는 최대 횟수 */
export const SEED_PURCHASE_CAS_MAX_ATTEMPTS = 5

type SeedUpdatePatch = Record<string, unknown>

function buildSeedPatches(newCredits: number, treeId: PlantTreeId): SeedUpdatePatch[] {
  const updatedAt = new Date().toISOString()
  /**
   * `credits_piggy` · `credits_wallet` 은 **일부러 넣지 않습니다.**
   * 이 경로는 저금통을 관리하지 않는데도 읽어 둔 값을 다시 저장했습니다.
   * 아이가 저금통에 크레딧을 옮기는 도중에 이 저장이 끼면
   * 그 사이 저금이 예전 값으로 덮어써져 사라집니다(잃어버린 갱신).
   */
  const withWallet = {
    credits: newCredits,
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
  treeId: PlantTreeId,
  /**
   * 씨앗값을 빼기 **직전에 읽었던 크레딧**.
   *
   * 비개발자 설명: 이 값이 그대로일 때만 저장합니다(CAS). 읽고 나서 저장하기까지 사이에
   * 아이가 미션을 끝내 크레딧이 늘었다면, 옛 계산값으로 덮어써서 그 보상이 사라지는 일을 막습니다.
   * 값이 바뀌어 있으면 저장하지 않고 `conflict` 를 돌려주어, 부르는 쪽이 다시 계산하게 합니다.
   */
  observedCredits: number,
): Promise<{ ok: boolean; error: string | null; conflict?: boolean }> {
  const patches = buildSeedPatches(newCredits, treeId)

  for (const patch of patches) {
    const { data, error } = await db
      .from('child_stats')
      .update(patch)
      .eq('child_id', childId)
      /** 핵심: 읽은 잔액 그대로일 때만 차감 — 그사이 들어온 보상을 덮어쓰지 않음 */
      .eq('credits', observedCredits)
      .select('child_id')

    if (!error && data && data.length > 0) {
      return { ok: true, error: null }
    }
    /**
     * 컬럼이 없어서 실패한 게 아니라면(= 오류 없이 0행), 잔액이 그사이 바뀐 것입니다.
     * 다른 패치 모양을 더 시도해 봐야 같은 이유로 0행이므로 바로 알려 줍니다.
     */
    if (!error) {
      return { ok: false, error: '크레딧이 그사이 바뀌었어요', conflict: true }
    }
    if (!isMissingColumnError(error.code, error.message)) {
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
