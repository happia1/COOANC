import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import { readChildStatInt } from '@/lib/childCreditsSplit'
import { normalizePlantPotProgress, type PlantStage } from '@/constants/plantTrees'

type PotRow = {
  hearts: unknown
  pot_stage: unknown
  pot_hearts_used: unknown
  pot_completed: unknown | null
}

function derivePot(row: PotRow) {
  const stageDb = Math.min(7, Math.max(0, readChildStatInt(row.pot_stage))) as PlantStage
  const heartsUsedDb = readChildStatInt(row.pot_hearts_used)
  const completedDb = Boolean(row.pot_completed ?? false)
  const synced = normalizePlantPotProgress(stageDb, heartsUsedDb, completedDb)
  return { synced, stageDb, heartsUsedDb, completedDb }
}

/**
 * POST /api/child/plant-repair
 * - `pot_stage` / `pot_hearts_used` / `pot_completed` 가 서로 안 맞을 때만 정규화해 저장합니다.
 * - `hearts` 및 기타 child_stats 컬럼은 변경하지 않습니다.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })
    }

    let bodyChildId: unknown
    try {
      bodyChildId = (await req.json())?.childId
    } catch {
      bodyChildId = undefined
    }

    const resolved = await resolveApiActorChildId(supabase, user, bodyChildId)
    if (resolved.ok === false) return resolved.response
    const childId = resolved.childId

    const { data: row, error } = await supabase
      .from('child_stats')
      .select('hearts, pot_stage, pot_hearts_used, pot_completed')
      .eq('child_id', childId)
      .maybeSingle()

    if (error || !row) {
      return NextResponse.json({ error: '자녀 통계를 찾을 수 없어요' }, { status: 404 })
    }

    const { synced, stageDb, heartsUsedDb, completedDb } = derivePot(row as PotRow)
    const needsDbRepair =
      synced.stage !== stageDb || synced.heartsUsed !== heartsUsedDb || synced.completed !== completedDb

    if (!needsDbRepair) {
      return NextResponse.json({ ok: true, repaired: false })
    }

    const { error: fixErr } = await supabase
      .from('child_stats')
      .update({
        pot_stage: synced.stage,
        pot_hearts_used: synced.heartsUsed,
        pot_completed: synced.completed,
      })
      .eq('child_id', childId)

    if (fixErr) {
      console.error('[plant-repair]', fixErr.message)
      return NextResponse.json({ error: '화분 상태를 맞추지 못했어요' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, repaired: true })
  } catch (e) {
    console.error('[plant-repair] unexpected', e)
    return NextResponse.json({ error: '서버 오류가 발생했어요' }, { status: 500 })
  }
}
