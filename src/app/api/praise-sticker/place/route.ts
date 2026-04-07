import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'

/**
 * POST /api/praise-sticker/place
 * 곰돌이 판 숫자 칸에 스티커를 붙입니다.
 *
 * - 클라이언트에서 직접 insert 하면, 부모가 자녀 화면 미리보기일 때 RLS(auth.uid()=child_id)에 막힐 수 있습니다.
 * - 여기서는 연결·지급 행을 세션으로 검증한 뒤, 가능하면 service_role 로 삽입해 036 마이그레이션 누락 환경에서도 동작하게 합니다.
 *
 * body: { childId: string (부모일 때 필수), grantId: string, boardSlot: 1~20, xRatio, yRatio, scaleRatio? }
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

  const grantId = typeof body.grantId === 'string' ? body.grantId.trim() : ''
  const boardSlot = typeof body.boardSlot === 'number' ? body.boardSlot : Number(body.boardSlot)
  const xRatio = typeof body.xRatio === 'number' ? body.xRatio : Number(body.xRatio)
  const yRatio = typeof body.yRatio === 'number' ? body.yRatio : Number(body.yRatio)
  const scaleRatio =
    body.scaleRatio == null || body.scaleRatio === ''
      ? 1
      : typeof body.scaleRatio === 'number'
        ? body.scaleRatio
        : Number(body.scaleRatio)

  if (!grantId) {
    return NextResponse.json({ error: '스티커 정보가 없어요' }, { status: 400 })
  }
  if (!Number.isInteger(boardSlot) || boardSlot < 1 || boardSlot > 20) {
    return NextResponse.json({ error: '칸 번호가 올바르지 않아요' }, { status: 400 })
  }
  if (!Number.isFinite(xRatio) || !Number.isFinite(yRatio) || xRatio < 0 || xRatio > 1 || yRatio < 0 || yRatio > 1) {
    return NextResponse.json({ error: '위치 값이 올바르지 않아요' }, { status: 400 })
  }
  if (!Number.isFinite(scaleRatio) || scaleRatio <= 0 || scaleRatio > 3) {
    return NextResponse.json({ error: '크기 값이 올바르지 않아요' }, { status: 400 })
  }

  /** 이 자녀에게 실제로 지급된 스티커인지 확인(위조 grant_id 방지) */
  const { data: grant, error: grantErr } = await supabase
    .from('praise_sticker_grants')
    .select('id')
    .eq('id', grantId)
    .eq('child_id', childId)
    .maybeSingle()

  if (grantErr) {
    console.error('[praise-sticker/place] grant lookup', grantErr.code, grantErr.message)
    return NextResponse.json({ error: '스티커를 확인할 수 없어요' }, { status: 500 })
  }
  if (!grant) {
    return NextResponse.json({ error: '받은 스티커가 아니에요' }, { status: 404 })
  }

  const service = createServiceRoleClient()
  const db = service ?? supabase
  const { data, error } = await db
    .from('praise_sticker_placements')
    .insert({
      grant_id: grantId,
      child_id: childId,
      board_slot: boardSlot,
      x_ratio: xRatio,
      y_ratio: yRatio,
      scale_ratio: scaleRatio,
    })
    .select('id, grant_id, child_id, x_ratio, y_ratio, scale_ratio, board_slot, created_at')
    .single()

  if (error) {
    console.error('[praise-sticker/place]', error.code, error.message, {
      usedServiceRole: Boolean(service),
    })
    if (error.code === '23505') {
      return NextResponse.json({ error: '이미 붙은 칸이거나 같은 스티커를 다시 붙이려 했어요' }, { status: 409 })
    }
    const msgLc = `${error.message ?? ''}`.toLowerCase()
    if (error.code === '42501' || msgLc.includes('row-level security')) {
      return NextResponse.json(
        {
          error:
            '저장 권한이 없어요. Supabase에 마이그레이션 036(praise_sticker_placements 부모 insert)을 적용하거나, 서버에 SUPABASE_SERVICE_ROLE_KEY를 설정해 주세요.',
        },
        { status: 403 },
      )
    }
    return NextResponse.json({ error: '판에 붙이지 못했어요' }, { status: 500 })
  }

  return NextResponse.json({ placement: data }, { status: 201 })
}
