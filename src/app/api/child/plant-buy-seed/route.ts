import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import { readChildStatInt } from '@/lib/childCreditsSplit'
import {
  applySeedPurchaseUpdate,
  SEED_PURCHASE_CAS_MAX_ATTEMPTS,
  loadChildStatsForSeed,
  logSeedPurchaseSafe,
  readPiggyFromStatsRow,
} from '@/lib/plantBuySeedServer'
import { getPlantTree, resolveTreeId, type PlantTreeId } from '@/constants/plantTrees'

/**
 * POST /api/child/plant-buy-seed
 * body: { treeId: PlantTreeId, childId? }
 */
export async function POST(req: NextRequest) {
  try {
    const authSupabase = await createClient()
    const {
      data: { user },
      error: authErr,
    } = await authSupabase.auth.getUser()

    if (authErr) {
      console.error('[plant-buy-seed] auth', authErr.message)
      return NextResponse.json({ error: '인증 확인에 실패했어요', detail: authErr.message }, { status: 401 })
    }
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

    const { row, error: loadErr } = await loadChildStatsForSeed(db, childId)
    if (loadErr || !row) {
      return NextResponse.json(
        { error: loadErr === '통계 행을 찾을 수 없어요' ? loadErr : '통계를 읽지 못했어요', detail: loadErr ?? undefined },
        { status: loadErr === '통계 행을 찾을 수 없어요' ? 404 : 500 },
      )
    }

    const currentCredits = readChildStatInt(row.credits)
    const piggy = readPiggyFromStatsRow(row)

    /** 8초 안 같은 씨앗 중복 탭 — 추가 차감 없이 현재 상태 반환 */
    const dedupeSince = new Date(Date.now() - 8000).toISOString()
    const { data: recentDup } = await db
      .from('plant_seed_purchases')
      .select('id')
      .eq('child_id', childId)
      .eq('tree_id', treeId)
      .gte('purchased_at', dedupeSince)
      .order('purchased_at', { ascending: false })
      .limit(1)

    if (recentDup && recentDup.length > 0) {
      const { data: after } = await db
        .from('child_stats')
        .select('credits, hearts, pot_stage, pot_hearts_used, pot_completed, pot_tree_id')
        .eq('child_id', childId)
        .maybeSingle()

      const resolvedTreeId = after?.pot_tree_id
        ? resolveTreeId(after.pot_tree_id as string)
        : treeId

      return NextResponse.json({
        success: true,
        hasChosenSeed: true,
        deduped: true,
        newCredits: after ? readChildStatInt(after.credits) : currentCredits,
        treeId: resolvedTreeId as PlantTreeId,
        hearts: after ? readChildStatInt(after.hearts) : readChildStatInt(row.hearts),
        pot_stage: after ? readChildStatInt(after.pot_stage) : 0,
        pot_hearts_used: after ? readChildStatInt(after.pot_hearts_used) : 0,
        pot_completed: after ? Boolean(after.pot_completed) : false,
        credits_piggy: piggy,
      })
    }

    /**
     * 씨앗값 차감은 **읽은 잔액 그대로일 때만** 저장하고(CAS), 그사이 바뀌었으면
     * 최신 잔액을 다시 읽어 재시도합니다.
     *
     * 비개발자 설명: 아이가 씨앗을 사는 순간에 미션 보상이 같이 들어오면, 예전에는
     * 씨앗 결제가 옛 잔액으로 덮어써서 그 보상이 사라졌습니다. 이제는 그런 경우
     * 최신 잔액으로 다시 계산해서 둘 다 반영됩니다.
     */
    let liveCredits = currentCredits
    let newCredits = currentCredits - cost
    let updated = false
    let upErr: string | null = null

    for (let attempt = 0; attempt < SEED_PURCHASE_CAS_MAX_ATTEMPTS; attempt += 1) {
      if (liveCredits < cost) {
        return NextResponse.json(
          {
            error: 'insufficient_credits',
            required: cost,
            current: liveCredits,
          },
          { status: 400 },
        )
      }

      newCredits = liveCredits - cost
      const res = await applySeedPurchaseUpdate(db, childId, newCredits, treeId, liveCredits)
      if (res.ok) {
        updated = true
        break
      }
      upErr = res.error
      if (!res.conflict) break

      /** 경합 — 최신 잔액을 다시 읽어 재시도 */
      const { row: fresh } = await loadChildStatsForSeed(db, childId)
      if (!fresh) break
      liveCredits = readChildStatInt(fresh.credits)
    }

    if (!updated) {
      console.error('[plant-buy-seed] update failed', upErr)
      return NextResponse.json(
        {
          error: '씨앗 심기에 실패했어요',
          detail: upErr ?? 'DB 업데이트 실패',
        },
        { status: 500 },
      )
    }

    await logSeedPurchaseSafe(db, childId, treeId, cost)

    const { data: after, error: afterErr } = await db
      .from('child_stats')
      .select('credits, hearts, pot_stage, pot_hearts_used, pot_completed, pot_tree_id')
      .eq('child_id', childId)
      .maybeSingle()

    if (afterErr) {
      console.warn('[plant-buy-seed] read after', afterErr.message)
    }

    const savedRaw = (after as { pot_tree_id?: string } | null)?.pot_tree_id
    const resolvedTreeId = savedRaw
      ? resolveTreeId(savedRaw)
      : treeId

    if (after && savedRaw && resolveTreeId(savedRaw) !== treeId) {
      console.warn('[plant-buy-seed] pot_tree_id mismatch', { expected: treeId, saved: savedRaw })
    }

    return NextResponse.json({
      success: true,
      hasChosenSeed: true,
      newCredits: after ? readChildStatInt(after.credits) : newCredits,
      treeId: resolvedTreeId as PlantTreeId,
      hearts: after ? readChildStatInt(after.hearts) : readChildStatInt(row.hearts),
      pot_stage: after ? readChildStatInt(after.pot_stage) : 0,
      pot_hearts_used: after ? readChildStatInt(after.pot_hearts_used) : 0,
      pot_completed: after ? Boolean(after.pot_completed) : false,
      credits_piggy: piggy,
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    console.error('[plant-buy-seed] unexpected', e)
    return NextResponse.json({ error: '서버 오류가 발생했어요', detail }, { status: 500 })
  }
}
