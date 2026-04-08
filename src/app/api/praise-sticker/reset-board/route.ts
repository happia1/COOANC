import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'

/** 곰돌이 판 슬롯 수 — 이 개수만큼 칸에 붙인 뒤 리셋하면 「한 판 완주」로 봅니다 */
const BOARD_SLOT_TOTAL = 20

/**
 * POST /api/praise-sticker/reset-board
 * - 스티커판(placements) 비우기 + child_stats.praise_board_cleared_at 갱신
 * - 리셋 직전 배치가 **20칸 전부**였다면 한 판 완주로 보고, 해당 자녀의 praise_sticker_grants(발행 기록)도 전부 삭제합니다.
 * - 부모가 중간에 「판 비우기」만 할 때는 칸 수가 20 미만이면 발행 기록은 남깁니다.
 * - body.deleteAllGrants === true 이면 칸 수와 관계없이 placements 비운 뒤 grants 도 전부 삭제합니다(보낸 스티커 기록 초기화).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  const resolved = await resolveApiActorChildId(supabase, user, body.childId)
  if (resolved.ok === false) {
    return resolved.response
  }
  const childId = resolved.childId

  /** true 이면 칸 개수와 관계없이 praise_sticker_grants 전부 삭제(부모 「보낸 스티커 전부 삭제」) */
  const deleteAllGrantsRequested = body.deleteAllGrants === true

  const service = createServiceRoleClient()
  const db = service ?? supabase
  const { data: beforeRows, error: beforeErr } = await db
    .from('praise_sticker_placements')
    .select('id, grant_id')
    .eq('child_id', childId)
  if (beforeErr) {
    console.error('[praise-sticker/reset-board] before lookup', beforeErr.code, beforeErr.message)
  }

  const deletedPlacementCount = beforeRows?.length ?? 0
  /** 20칸이 꽉 찬 상태에서만 발행(grants)까지 삭제 — 부모의 부분 비우기와 구분 */
  const fullBoardCompleted = deletedPlacementCount === BOARD_SLOT_TOTAL
  /** 한 판 완주이거나, 부모가 명시적으로 보낸 스티커 전부 삭제를 요청한 경우 */
  const shouldDeleteGrants = fullBoardCompleted || deleteAllGrantsRequested

  const { error } = await db.from('praise_sticker_placements').delete().eq('child_id', childId)
  if (error) {
    console.error('[praise-sticker/reset-board]', error.code, error.message)
    return NextResponse.json({ error: '스티커판 초기화에 실패했어요' }, { status: 500 })
  }

  let deletedGrantCount = 0
  if (shouldDeleteGrants) {
    const { count, error: countErr } = await db
      .from('praise_sticker_grants')
      .select('*', { count: 'exact', head: true })
      .eq('child_id', childId)
    if (countErr) {
      console.error('[praise-sticker/reset-board] grants count', countErr.code, countErr.message)
    } else {
      deletedGrantCount = count ?? 0
    }
    const { error: grantsErr } = await db.from('praise_sticker_grants').delete().eq('child_id', childId)
    if (grantsErr) {
      console.error('[praise-sticker/reset-board] grants delete', grantsErr.code, grantsErr.message)
      return NextResponse.json({ error: '스티커 발행 기록 삭제에 실패했어요' }, { status: 500 })
    }
  }

  /** 한 판이 끝난 시각 — 클라·DB가 같은 기준으로 예전 지급 스티커를 숨깁니다 */
  const clearedAt = new Date().toISOString()
  const { error: statsErr } = await db
    .from('child_stats')
    .update({ praise_board_cleared_at: clearedAt, updated_at: clearedAt })
    .eq('child_id', childId)
  if (statsErr) {
    console.error('[praise-sticker/reset-board] child_stats', statsErr.code, statsErr.message)
    /** 배치는 이미 비었으므로 성공으로 두되, clearedAt 없으면 클라는 sessionStorage 만 의존 */
  }

  console.log('[praise-sticker/reset-board] success', {
    childId,
    deletedPlacementCount,
    deletedGrantCount,
    fullBoardCompleted,
    clearedAt,
  })
  const grantsDeleted = shouldDeleteGrants

  return NextResponse.json({
    ok: true,
    deletedPlacementCount,
    deletedGrantCount,
    /** 클라에서 grants 목록을 비울 때 사용(완주 또는 deleteAllGrants 요청) */
    grantsDeleted,
    clearedAt,
  })
}

