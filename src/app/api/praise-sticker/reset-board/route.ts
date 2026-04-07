import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'

/**
 * POST /api/praise-sticker/reset-board
 * - 스티커판(placements) 20칸 완료 후 전체 초기화용 API
 * - 부모 미리보기/자녀 본인 세션 모두 childId 검증 후 삭제합니다.
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
  if (!resolved.ok) {
    return resolved.response
  }
  const childId = resolved.childId

  const service = createServiceRoleClient()
  const db = service ?? supabase
  const { data: beforeRows, error: beforeErr } = await db
    .from('praise_sticker_placements')
    .select('id, grant_id')
    .eq('child_id', childId)
  if (beforeErr) {
    console.error('[praise-sticker/reset-board] before lookup', beforeErr.code, beforeErr.message)
  }

  const { error } = await db.from('praise_sticker_placements').delete().eq('child_id', childId)
  if (error) {
    console.error('[praise-sticker/reset-board]', error.code, error.message)
    return NextResponse.json({ error: '스티커판 초기화에 실패했어요' }, { status: 500 })
  }

  console.log('[praise-sticker/reset-board] success', { childId, deletedPlacementCount: beforeRows?.length ?? 0 })
  return NextResponse.json({ ok: true, deletedPlacementCount: beforeRows?.length ?? 0 })
}

