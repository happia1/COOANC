import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/market/complete-delivery
 * - 자녀가 배달 축하 연출을 끝낸 뒤 「받았어요」를 누를 때 호출합니다.
 * - 승인(approved) 상태만 → 배송 완료(delivered) 로 바꿉니다.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'child') {
    /* 임시: 완료 API 거절 원인 추적(역할 검사) — 디버그 세션 끝나면 제거 */
    // #region agent log
    void fetch('http://127.0.0.1:7447/ingest/9dd0682d-d3af-41fb-8d82-be18fff89b7a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '59d117' },
      body: JSON.stringify({
        sessionId: '59d117',
        location: 'complete-delivery/route.ts:403',
        message: '역할이 child 아님 → 403',
        data: { role: profile?.role ?? 'null' },
        timestamp: Date.now(),
        hypothesisId: 'H1',
      }),
    }).catch(() => {})
    // #endregion
    return NextResponse.json({ error: '자녀 계정만 완료할 수 있어요' }, { status: 403 })
  }

  let requestId: string
  try {
    const body = await req.json()
    requestId = body.requestId
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!requestId) {
    return NextResponse.json({ error: '요청 id 가 필요해요' }, { status: 400 })
  }

  const { data: row } = await supabase
    .from('purchase_requests')
    .select('id, child_id, status')
    .eq('id', requestId)
    .eq('child_id', user.id)
    .maybeSingle()

  if (!row) {
    // #region agent log
    void fetch('http://127.0.0.1:7447/ingest/9dd0682d-d3af-41fb-8d82-be18fff89b7a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '59d117' },
      body: JSON.stringify({
        sessionId: '59d117',
        location: 'complete-delivery/route.ts:404',
        message: 'purchase_requests 행 없음(세션 user.id와 child_id 불일치 가능)',
        data: { requestIdLen: requestId.length },
        timestamp: Date.now(),
        hypothesisId: 'H2',
      }),
    }).catch(() => {})
    // #endregion
    return NextResponse.json({ error: '요청을 찾을 수 없어요' }, { status: 404 })
  }

  if (row.status !== 'approved') {
    // #region agent log
    void fetch('http://127.0.0.1:7447/ingest/9dd0682d-d3af-41fb-8d82-be18fff89b7a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '59d117' },
      body: JSON.stringify({
        sessionId: '59d117',
        location: 'complete-delivery/route.ts:409',
        message: '상태가 approved 아님',
        data: { status: row.status },
        timestamp: Date.now(),
        hypothesisId: 'H3',
      }),
    }).catch(() => {})
    // #endregion
    return NextResponse.json({ error: '이미 처리됐거나 배송 완료 단계가 아니에요' }, { status: 409 })
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('purchase_requests')
    .update({ status: 'delivered', delivered_at: now })
    .eq('id', requestId)

  if (error) {
    // #region agent log
    void fetch('http://127.0.0.1:7447/ingest/9dd0682d-d3af-41fb-8d82-be18fff89b7a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '59d117' },
      body: JSON.stringify({
        sessionId: '59d117',
        location: 'complete-delivery/route.ts:500',
        message: 'Supabase update 실패',
        data: { code: error.code, message: error.message?.slice(0, 80) },
        timestamp: Date.now(),
        hypothesisId: 'H5',
      }),
    }).catch(() => {})
    // #endregion
    return NextResponse.json({ error: '저장에 실패했어요' }, { status: 500 })
  }

  // #region agent log
  void fetch('http://127.0.0.1:7447/ingest/9dd0682d-d3af-41fb-8d82-be18fff89b7a', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '59d117' },
    body: JSON.stringify({
      sessionId: '59d117',
      location: 'complete-delivery/route.ts:ok',
      message: '배송 완료 처리 성공',
      data: {},
      timestamp: Date.now(),
      hypothesisId: 'H0',
    }),
  }).catch(() => {})
  // #endregion

  return NextResponse.json({ ok: true })
}
