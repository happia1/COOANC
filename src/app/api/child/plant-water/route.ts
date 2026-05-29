import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import { readChildStatInt } from '@/lib/childCreditsSplit'
import { HEARTS_PER_STAGE, normalizePlantPotProgress, type PlantStage } from '@/constants/plantTrees'

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
  return {
    freshHearts: readChildStatInt(row.hearts),
    synced,
    stageDb,
    heartsUsedDb,
    completedDb,
  }
}

/**
 * POST /api/child/plant-water
 * - 브라우저에서 `child_stats` 를 직접 UPDATE 할 때(RLS·`.select()` 반환 등) 물이 안 먹히는 문제를 피하려
 *   **쿠키 세션이 있는 서버**에서 같은 로직으로 갱신합니다.
 * - 자녀 로그인: 본인 행만 / 부모 미리보기: body.childId + family_links 검증 (`resolveApiActorChildId`)
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

    const loadRow = async (): Promise<PotRow | null> => {
      const { data, error } = await supabase
        .from('child_stats')
        .select('hearts, pot_stage, pot_hearts_used, pot_completed')
        .eq('child_id', childId)
        .maybeSingle()
      if (error) {
        console.error('[plant-water] select', error.message)
        return null
      }
      return data as PotRow | null
    }

    let row = await loadRow()
    if (!row) {
      return NextResponse.json({ error: '자녀 통계를 찾을 수 없어요' }, { status: 404 })
    }

    let { freshHearts, synced, stageDb, heartsUsedDb, completedDb } = derivePot(row)

    const needsDbRepair =
      synced.stage !== stageDb ||
      synced.heartsUsed !== heartsUsedDb ||
      synced.completed !== completedDb

    if (needsDbRepair) {
      const { error: fixErr } = await supabase
        .from('child_stats')
        .update({
          pot_stage: synced.stage,
          pot_hearts_used: synced.heartsUsed,
          pot_completed: synced.completed,
        })
        .eq('child_id', childId)
      if (fixErr) {
        console.error('[plant-water] repair', fixErr.message)
        return NextResponse.json({ error: '화분 상태를 맞추지 못했어요' }, { status: 500 })
      }
      row = await loadRow()
      if (!row) {
        return NextResponse.json({ error: '통계를 다시 읽지 못했어요' }, { status: 500 })
      }
      ;({ freshHearts, synced } = derivePot(row))
    }

    const stage = synced.stage
    const heartsUsed = synced.heartsUsed

    /**
     * 7단계(다 익은 열매)에서만 씨앗으로 돌아갑니다.
     * `completed` 단독 조건은 제거 — 잘못된 DB 플래그로 성장 분기가 막히던 문제를 막습니다.
     */
    if (stage === 7) {
      const { data: afterReset, error: resetErr } = await supabase
        .from('child_stats')
        .update({ pot_stage: 0, pot_hearts_used: 0, pot_completed: false })
        .eq('child_id', childId)
        .select('hearts, pot_stage, pot_hearts_used, pot_completed')
        .maybeSingle()
      if (resetErr || !afterReset) {
        console.error('[plant-water] reset', resetErr?.message, Boolean(afterReset))
        return NextResponse.json({ error: '화분을 초기화하지 못했어요' }, { status: 500 })
      }
      const n = derivePot(afterReset as PotRow).synced
      return NextResponse.json({
        ok: true,
        reset: true,
        hearts: readChildStatInt(afterReset.hearts),
        pot_stage: n.stage,
        pot_hearts_used: n.heartsUsed,
        pot_completed: n.completed,
      })
    }

    if (freshHearts <= 0) {
      return NextResponse.json({ ok: false, code: 'NO_HEARTS' as const }, { status: 400 })
    }

    const newHeartsUsed = heartsUsed + 1
    const needed = HEARTS_PER_STAGE[stage]
    const levelUp = needed > 0 && newHeartsUsed >= needed
    const newStage = levelUp ? (Math.min(stage + 1, 7) as PlantStage) : stage
    const newHeartsUsedAfter = levelUp ? 0 : newHeartsUsed
    const isCompleted = newStage === 7

    const { data: after, error: upErr } = await supabase
      .from('child_stats')
      .update({
        hearts: freshHearts - 1,
        pot_stage: newStage,
        pot_hearts_used: newHeartsUsedAfter,
        pot_completed: isCompleted,
      })
      .eq('child_id', childId)
      .select('hearts, pot_stage, pot_hearts_used, pot_completed')
      .maybeSingle()

    if (upErr) {
      console.error('[plant-water] update', upErr.message)
      return NextResponse.json({ error: '물주기 저장에 실패했어요' }, { status: 500 })
    }
    if (!after) {
      console.error('[plant-water] update returned 0 rows — child_id 또는 RLS 확인')
      return NextResponse.json({ error: '물주기 권한이 없거나 행이 없어요' }, { status: 403 })
    }

    return NextResponse.json({
      ok: true,
      grew: levelUp,
      newStage: levelUp ? newStage : undefined,
      hearts: readChildStatInt(after.hearts),
      pot_stage: readChildStatInt(after.pot_stage) as PlantStage,
      pot_hearts_used: readChildStatInt(after.pot_hearts_used),
      pot_completed: Boolean(after.pot_completed),
    })
  } catch (e) {
    console.error('[plant-water] unexpected', e)
    return NextResponse.json({ error: '서버 오류가 발생했어요' }, { status: 500 })
  }
}
