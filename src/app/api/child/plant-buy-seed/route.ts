import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import { readChildStatInt } from '@/lib/childCreditsSplit'
import { getPlantTree, resolveTreeId, type PlantTreeId } from '@/constants/plantTrees'

/**
 * POST /api/child/plant-buy-seed
 * body: { treeId: PlantTreeId, childId? }
 *
 * - 가용 크레딧(`child_stats.credits`)에서 씨앗 비용 차감
 * - 화분 진행 초기화 + `pot_tree_id` 저장
 * - 마켓·저금통 API 와 같이 `credits_wallet: 0` 을 맞춰 예전 split CHECK 와 충돌하지 않게 합니다.
 */
export async function POST(req: NextRequest) {
  try {
    const authSupabase = await createClient()
    const {
      data: { user },
    } = await authSupabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })
    }

    let bodyChildId: unknown
    let bodyTreeId: unknown
    try {
      const body = await req.json()
      bodyChildId = body.childId
      bodyTreeId = body.treeId
    } catch {
      return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
    }

    const resolved = await resolveApiActorChildId(authSupabase, user, bodyChildId)
    if (resolved.ok === false) return resolved.response
    const childId = resolved.childId

    const treeId = resolveTreeId(typeof bodyTreeId === 'string' ? bodyTreeId : null)
    const tree = getPlantTree(treeId)
    const cost = tree.creditCost

    const db = createServiceRoleClient() ?? authSupabase

    const { data: row, error: readErr } = await db
      .from('child_stats')
      .select(
        'credits, credits_piggy, credits_wallet, hearts, pot_stage, pot_hearts_used, pot_completed, pot_tree_id',
      )
      .eq('child_id', childId)
      .maybeSingle()

    if (readErr) {
      console.error('[plant-buy-seed] select', readErr.message, readErr.code)
      return NextResponse.json(
        { error: '통계를 읽지 못했어요', detail: readErr.message },
        { status: 500 },
      )
    }
    if (!row) {
      return NextResponse.json({ error: '통계 행을 찾을 수 없어요' }, { status: 404 })
    }

    const currentCredits = readChildStatInt(row.credits)
    const piggy = readChildStatInt(row.credits_piggy)
    if (currentCredits < cost) {
      return NextResponse.json(
        {
          error: 'insufficient_credits',
          required: cost,
          current: currentCredits,
        },
        { status: 400 },
      )
    }

    const newCredits = currentCredits - cost
    const updatedAt = new Date().toISOString()

    const basePatch = {
      credits: newCredits,
      credits_wallet: 0,
      credits_piggy: piggy,
      pot_stage: 0,
      pot_hearts_used: 0,
      pot_completed: false,
      updated_at: updatedAt,
    }

    const patchWithTree = { ...basePatch, pot_tree_id: treeId }

    let { data: updatedRows, error: upErr } = await db
      .from('child_stats')
      .update(patchWithTree)
      .eq('child_id', childId)
      .select('child_id')

    if (upErr?.code === '42703' || /pot_tree_id/i.test(upErr.message ?? '')) {
      ;({ data: updatedRows, error: upErr } = await db
        .from('child_stats')
        .update(basePatch)
        .eq('child_id', childId)
        .select('child_id'))
    }

    if (upErr) {
      console.error('[plant-buy-seed] update', upErr.message, upErr.code)
      return NextResponse.json(
        { error: '씨앗 심기에 실패했어요', detail: upErr.message, code: upErr.code },
        { status: 500 },
      )
    }

    if (!updatedRows?.length) {
      console.error('[plant-buy-seed] update 0 rows', childId)
      return NextResponse.json(
        {
          error: '씨앗 심기에 실패했어요',
          detail: 'child_stats 행이 갱신되지 않았어요(RLS·child_id 확인)',
        },
        { status: 500 },
      )
    }

    const { data: after, error: readAfterErr } = await db
      .from('child_stats')
      .select('credits, hearts, pot_stage, pot_hearts_used, pot_completed, pot_tree_id')
      .eq('child_id', childId)
      .maybeSingle()

    if (readAfterErr) {
      console.warn('[plant-buy-seed] read after update', readAfterErr.message)
    }

    const { error: logErr } = await db.from('plant_seed_purchases').insert({
      child_id: childId,
      tree_id: treeId,
      credit_cost: cost,
    })

    if (logErr) {
      console.warn('[plant-buy-seed] purchase log', logErr.message)
    }

    const resolvedTreeId = after
      ? (resolveTreeId(after.pot_tree_id as string) as PlantTreeId)
      : treeId

    return NextResponse.json({
      success: true,
      newCredits: after ? readChildStatInt(after.credits) : newCredits,
      treeId: resolvedTreeId,
      hearts: after ? readChildStatInt(after.hearts) : readChildStatInt(row.hearts),
      pot_stage: after ? readChildStatInt(after.pot_stage) : 0,
      pot_hearts_used: after ? readChildStatInt(after.pot_hearts_used) : 0,
      pot_completed: after ? Boolean(after.pot_completed) : false,
      credits_piggy: piggy,
    })
  } catch (e) {
    console.error('[plant-buy-seed] unexpected', e)
    return NextResponse.json({ error: '서버 오류가 발생했어요' }, { status: 500 })
  }
}
