import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/market/approve
 * 구매 요청 승인 또는 반려 (부모 전용)
 * body: { requestId, action: 'approve' | 'reject', parentNote?: string }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  let requestId: string, action: 'approve' | 'reject', parentNote: string | null
  try {
    ;({ requestId, action, parentNote = null } = await req.json())
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!requestId || !['approve', 'reject'].includes(action)) {
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

  if (request.status !== 'pending') {
    return NextResponse.json({ error: '이미 처리된 요청이에요' }, { status: 409 })
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

  if (action === 'approve') {
    await supabase
      .from('purchase_requests')
      .update({
        status: 'approved',
        parent_note: parentNote,
        approved_at: now,
      })
      .eq('id', requestId)

    return NextResponse.json({ status: 'approved' })
  }

  // 반려: 크레딧 환불
  const { data: stats } = await supabase
    .from('child_stats')
    .select('credits')
    .eq('child_id', request.child_id)
    .maybeSingle()

  if (stats) {
    await supabase
      .from('child_stats')
      .update({ credits: stats.credits + request.item_price })
      .eq('child_id', request.child_id)
  }

  await supabase
    .from('purchase_requests')
    .update({
      status: 'rejected',
      parent_note: parentNote,
    })
    .eq('id', requestId)

  return NextResponse.json({ status: 'rejected' })
}
