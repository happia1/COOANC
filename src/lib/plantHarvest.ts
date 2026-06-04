import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getHarvestFruitName,
  randomHarvestAmount,
  resolveTreeId,
  TREE_LIST,
  type PlantTreeId,
} from '@/constants/plantTrees'
import { readChildStatInt } from '@/lib/childCreditsSplit'

export type PlantHarvestCelebrate = {
  fruitId: PlantTreeId
  fruitName: string
  amount: number
}

export type PlantHarvestInventoryRow = {
  fruitId: PlantTreeId
  fruitName: string
  emoji: string
  quantity: number
}

/**
 * 화분 7단계 완성 시 수확량을 인벤토리에 더합니다.
 */
export async function addPlantHarvest(
  db: SupabaseClient,
  childId: string,
  treeIdRaw: string | null | undefined,
  amount: number = randomHarvestAmount(),
): Promise<PlantHarvestCelebrate | null> {
  const fruitId = resolveTreeId(treeIdRaw)
  const qty = Math.max(1, Math.min(99, Math.trunc(amount)))

  const { data: existing, error: readErr } = await db
    .from('plant_harvest_inventory')
    .select('quantity')
    .eq('child_id', childId)
    .eq('fruit_id', fruitId)
    .maybeSingle()

  if (readErr) {
    console.warn('[plantHarvest] read', readErr.message)
    return null
  }

  const nextQty = (existing ? readChildStatInt(existing.quantity) : 0) + qty

  let upErr = null
  if (existing) {
    const res = await db
      .from('plant_harvest_inventory')
      .update({ quantity: nextQty, updated_at: new Date().toISOString() })
      .eq('child_id', childId)
      .eq('fruit_id', fruitId)
    upErr = res.error
  } else {
    const res = await db.from('plant_harvest_inventory').insert({
      child_id: childId,
      fruit_id: fruitId,
      quantity: nextQty,
    })
    upErr = res.error
  }

  if (upErr) {
    console.warn('[plantHarvest] save', upErr.message, upErr.code)
    return null
  }

  return {
    fruitId,
    fruitName: getHarvestFruitName(fruitId),
    amount: qty,
  }
}

export async function fetchPlantHarvestInventory(
  db: SupabaseClient,
  childId: string,
): Promise<PlantHarvestInventoryRow[]> {
  const { data, error } = await db
    .from('plant_harvest_inventory')
    .select('fruit_id, quantity')
    .eq('child_id', childId)

  if (error) {
    console.warn('[plantHarvest] list', error.message)
    return TREE_LIST.map((t) => ({
      fruitId: t.id,
      fruitName: getHarvestFruitName(t.id),
      emoji: t.emoji,
      quantity: 0,
    }))
  }

  const qtyById = new Map<string, number>()
  for (const row of data ?? []) {
    const id = typeof row.fruit_id === 'string' ? row.fruit_id : ''
    qtyById.set(id, readChildStatInt(row.quantity))
  }

  return TREE_LIST.map((t) => ({
    fruitId: t.id,
    fruitName: getHarvestFruitName(t.id),
    emoji: t.emoji,
    quantity: qtyById.get(t.id) ?? 0,
  }))
}
