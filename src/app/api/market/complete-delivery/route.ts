import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'

/**
 * POST /api/market/complete-delivery
 * - 배달 연출 후 「받았어요」를 누를 때 호출합니다.
 * - 자녀 본인 로그인: 본인 `purchase_requests` 만 완료 처리합니다.
 * - 부모가 자녀 화면을 미리볼 때: body 의 `childId` 로 연결된 자녀 요청만 처리합니다 (`/api/market/request` 와 동일 규칙).
 * - 승인(approved) 상태만 → 배송 완료(delivered) 로 바꿉니다.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  let requestId: string
  let bodyChildId: unknown
  try {
    const body = await req.json()
    requestId = body.requestId
    /** 부모 미리보기일 때만 필수이며, 자녀 세션에서는 서버가 본인 id 로만 해석합니다 */
    bodyChildId = body.childId
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!requestId) {
    return NextResponse.json({ error: '요청 id 가 필요해요' }, { status: 400 })
  }

  const resolved = await resolveApiActorChildId(supabase, user, bodyChildId)
  if (resolved.ok === false) {
    return resolved.response
  }
  const actorChildId = resolved.childId

  const { data: row } = await supabase
    .from('purchase_requests')
    .select('id, child_id, status')
    .eq('id', requestId)
    .eq('child_id', actorChildId)
    .maybeSingle()

  if (!row) {
    return NextResponse.json({ error: '요청을 찾을 수 없어요' }, { status: 404 })
  }

  if (row.status !== 'approved') {
    return NextResponse.json({ error: '이미 처리됐거나 배송 완료 단계가 아니에요' }, { status: 409 })
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('purchase_requests')
    .update({ status: 'delivered', delivered_at: now })
    .eq('id', requestId)

  if (error) {
    return NextResponse.json({ error: '저장에 실패했어요' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
