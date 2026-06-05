import type { SupabaseClient } from '@supabase/supabase-js'
import { readChildStatInt } from '@/lib/childCreditsSplit'
import {
  clampPotStageForTree,
  getHeartsNeededForStage,
  normalizePlantPotProgress,
  readPotTreeIdFromDb,
  resolveHasChosenSeed,
  type PlantStage,
  type PlantTreeId,
} from '@/constants/plantTrees'

export type PlantPotStatePayload = {
  treeId: PlantTreeId
  stage: PlantStage
  heartsUsed: number
  heartsNeeded: number
  completed: boolean
  hasChosenSeed: boolean
  hearts: number
  repaired: boolean
}

type PotRow = {
  hearts: unknown
  pot_stage: unknown
  pot_hearts_used: unknown
  pot_completed: unknown | null
  pot_tree_id?: unknown
}

/** 서버(service role 우선)에서 child_stats·구매 이력을 읽어 화분 상태를 만듭니다 */
export async function loadPlantPotStateForChild(
  db: SupabaseClient,
  childId: string,
): Promise<{ ok: true; state: PlantPotStatePayload } | { ok: false; error: string }> {
  const { data: row, error } = await db
    .from('child_stats')
    .select('hearts, pot_stage, pot_hearts_used, pot_completed, pot_tree_id')
    .eq('child_id', childId)
    .maybeSingle()

  if (error) {
    return { ok: false, error: error.message }
  }
  if (!row) {
    return { ok: false, error: '통계 행을 찾을 수 없어요' }
  }

  const potRow = row as PotRow
  let treeId = readPotTreeIdFromDb(potRow.pot_tree_id)
  let stageDb = clampPotStageForTree(treeId, readChildStatInt(potRow.pot_stage))
  let heartsUsedDb = readChildStatInt(potRow.pot_hearts_used)
  let completedDb = Boolean(potRow.pot_completed ?? false)

  let normalized = normalizePlantPotProgress(stageDb, heartsUsedDb, completedDb, treeId)
  let repaired = false

  const needsDbRepair =
    normalized.stage !== stageDb ||
    normalized.heartsUsed !== heartsUsedDb ||
    normalized.completed !== completedDb

  if (needsDbRepair) {
    const { error: fixErr } = await db
      .from('child_stats')
      .update({
        pot_stage: normalized.stage,
        pot_hearts_used: normalized.heartsUsed,
        pot_completed: normalized.completed,
      })
      .eq('child_id', childId)

    if (fixErr) {
      return { ok: false, error: fixErr.message }
    }
    repaired = true
  }

  const { count: purchaseCount, error: purchaseErr } = await db
    .from('plant_seed_purchases')
    .select('id', { count: 'exact', head: true })
    .eq('child_id', childId)

  const hasChosenSeed = resolveHasChosenSeed(treeId, normalized, {
    purchaseCount: purchaseErr ? null : (purchaseCount ?? 0),
  })

  return {
    ok: true,
    state: {
      treeId,
      stage: normalized.stage,
      heartsUsed: normalized.heartsUsed,
      heartsNeeded: getHeartsNeededForStage(treeId, normalized.stage),
      completed: normalized.completed,
      hasChosenSeed,
      hearts: readChildStatInt(potRow.hearts),
      repaired,
    },
  }
}
