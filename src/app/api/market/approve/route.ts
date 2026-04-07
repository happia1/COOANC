import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/market/approve
 * 구매 요청 승인 또는 반려 (부모 전용)
 * body: { requestId, action: 'approve' | 'reject' | 'parent_shop', parentNote?: string }
 * - parent_shop: 외부 구매 안내 — 상태만 `parent_buying` 으로 바꿈(크레딧 트리거 없음)
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  let requestId: string, action: 'approve' | 'reject' | 'parent_shop', parentNote: string | null
  try {
    ;({ requestId, action, parentNote = null } = await req.json())
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!requestId || !['approve', 'reject', 'parent_shop'].includes(action)) {
    return NextResponse.json({ error: '필수 항목이 누락됐어요' }, { status: 400 })
  }

  // 부모 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 처리할 수 있어요' }, { status: 403 })
  }

  // 구매 요청 조회
  const { data: request } = await supabase
    .from('purchase_requests')
    .select('*, child_id, item_price, status')
    .eq('id', requestId)
    .maybeSingle()

  if (!request) {
    return NextResponse.json({ error: '요청을 찾을 수 없어요' }, { status: 404 })
  }

  // family_links 검증 (이 부모의 자녀인지)
  const { data: link } = await supabase
    .from('family_links')
    .select('id')
    .eq('parent_id', user.id)
    .eq('child_id', request.child_id)
    .maybeSingle()

  if (!link) {
    return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })
  }

  const now = new Date().toISOString()

  if (action === 'parent_shop') {
    if (request.status !== 'pending') {
      return NextResponse.json({ error: '대기 중인 요청만 전환할 수 있어요' }, { status: 409 })
    }
    const { data: updatedRows, error } = await supabase
      .from('purchase_requests')
      .update({
        status: 'parent_buying',
        parent_note: parentNote,
      })
      .eq('id', requestId)
      .eq('status', 'pending')
      .select('id')

    if (error) {
      const msg = typeof error.message === 'string' ? error.message : ''
      const isCheck =
        msg.includes('check constraint') ||
        msg.includes('purchase_requests_status_check') ||
        msg.includes('violates check constraint')
      return NextResponse.json(
        {
          error: isCheck
            ? 'DB에 구매 진행 상태가 아직 반영되지 않았어요. 관리자에게 마이그레이션(039) 적용을 요청해 주세요.'
            : '상태 변경에 실패했어요',
        },
        { status: 500 },
      )
    }

    if (!updatedRows?.length) {
      return NextResponse.json({ error: '대기 중인 요청만 전환할 수 있어요' }, { status: 409 })
    }

    return NextResponse.json({ status: 'parent_buying' })
  }

  if (action === 'approve') {
    if (request.status !== 'pending' && request.status !== 'parent_buying') {
      return NextResponse.json({ error: '승인할 수 없는 상태예요' }, { status: 409 })
    }
    // #region agent log
    {
      const { data: st } = await supabase
        .from('child_stats')
        .select('credits, credits_wallet')
        .eq('child_id', request.child_id)
        .maybeSingle()
      fetch('http://127.0.0.1:7447/ingest/9dd0682d-d3af-41fb-8d82-be18fff89b7a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '277560' },
        body: JSON.stringify({
          sessionId: '277560',
          runId: 'pre-approve',
          hypothesisId: 'A',
          location: 'api/market/approve/route.ts:approve:before',
          message: 'approve attempt context',
          data: {
            requestId,
            prevStatus: request.status,
            itemPrice: request.item_price,
            childCredits: st?.credits ?? null,
            childWallet: st?.credits_wallet ?? null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
    }
    // #endregion
    const { error: approveErr } = await supabase
      .from('purchase_requests')
      .update({
        status: 'approved',
        parent_note: parentNote,
        approved_at: now,
      })
      .eq('id', requestId)
      .in('status', ['pending', 'parent_buying'])

    if (approveErr) {
      // #region agent log
      fetch('http://127.0.0.1:7447/ingest/9dd0682d-d3af-41fb-8d82-be18fff89b7a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '277560' },
        body: JSON.stringify({
          sessionId: '277560',
          runId: 'pre-approve',
          hypothesisId: 'A',
          location: 'api/market/approve/route.ts:approve:error',
          message: 'purchase_requests update failed',
          data: {
            requestId,
            message: approveErr.message,
            code: approveErr.code,
            details: approveErr.details,
            hint: approveErr.hint,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion
      return NextResponse.json({ error: '승인 처리에 실패했어요' }, { status: 500 })
    }

    // #region agent log
    fetch('http://127.0.0.1:7447/ingest/9dd0682d-d3af-41fb-8d82-be18fff89b7a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '277560' },
      body: JSON.stringify({
        sessionId: '277560',
        runId: 'pre-approve',
        hypothesisId: 'C',
        location: 'api/market/approve/route.ts:approve:ok',
        message: 'purchase_requests approved',
        data: { requestId },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion

    return NextResponse.json({ status: 'approved' })
  }

  // 반려: 크레딧 환불 (대기·외부 구매 중 모두 가능)
  if (request.status !== 'pending' && request.status !== 'parent_buying') {
    return NextResponse.json({ error: '반려할 수 없는 상태예요' }, { status: 409 })
  }
  const { data: stats } = await supabase
    .from('child_stats')
    .select('credits, credits_wallet, credits_piggy')
    .eq('child_id', request.child_id)
    .maybeSingle()

  if (stats) {
    const w = typeof stats.credits_wallet === 'number' ? stats.credits_wallet : 0
    const p = typeof stats.credits_piggy === 'number' ? stats.credits_piggy : 0
    await supabase
      .from('child_stats')
      .update({
        credits: stats.credits + request.item_price,
        credits_wallet: w + request.item_price,
        credits_piggy: p,
      })
      .eq('child_id', request.child_id)
  }

  const { error: rejErr } = await supabase
    .from('purchase_requests')
    .update({
      status: 'rejected',
      parent_note: parentNote,
    })
    .eq('id', requestId)
    .in('status', ['pending', 'parent_buying'])

  if (rejErr) {
    return NextResponse.json({ error: '반려 처리에 실패했어요' }, { status: 500 })
  }

  return NextResponse.json({ status: 'rejected' })
}
