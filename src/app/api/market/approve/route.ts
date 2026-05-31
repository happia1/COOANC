import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { grantMarketContentRewardsForPurchaseOnce, isQuantityPurchasableMarketItem } from '@/lib/contentTickets'

/**
 * POST /api/market/approve
 * 구매 요청 — 부모가 상품을 받음 처리 또는 외부 쇼핑 안내 (부모 전용)
 * body: { requestId, action: 'approve' | 'parent_shop', parentNote?: string }
 * - approve: pending / parent_buying → delivered (크레딧 차감 없음 — 구매 시점에 이미 차감)
 * - parent_shop: 대기만 → parent_buying
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  let requestId: string
  let action: 'approve' | 'parent_shop'
  let parentNote: string | null
  try {
    const body = (await req.json()) as {
      requestId?: string
      action?: string
      parentNote?: string | null
    }
    requestId = body.requestId ?? ''
    action = body.action as 'approve' | 'parent_shop'
    parentNote = body.parentNote ?? null
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!requestId || !['approve', 'parent_shop'].includes(action)) {
    return NextResponse.json({ error: '필수 항목이 누락됐어요' }, { status: 400 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()

  if (profile?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 처리할 수 있어요' }, { status: 403 })
  }

  const { data: request } = await supabase
    .from('purchase_requests')
    .select('id, child_id, status, item_name, quantity, rewards_granted_at')
    .eq('id', requestId)
    .maybeSingle()

  if (!request) {
    return NextResponse.json({ error: '요청을 찾을 수 없어요' }, { status: 404 })
  }

  const { data: link } = await supabase
    .from('family_links')
    .select('id')
    .eq('parent_id', user.id)
    .eq('child_id', request.child_id)
    .maybeSingle()

  if (!link) {
    return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })
  }

  const childId = request.child_id as string
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
      .eq('child_id', childId)
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

  // approve: 실물/보상 수령 확인 → 바로 도착 완료 (크레딧 조작 없음)
  if (request.status !== 'pending' && request.status !== 'parent_buying') {
    return NextResponse.json({ error: '처리할 수 없는 상태예요' }, { status: 409 })
  }

  const { data: updatedRows, error: approveErr } = await supabase
    .from('purchase_requests')
    .update({
      status: 'delivered',
      approved_at: now,
    })
    .eq('id', requestId)
    .eq('child_id', childId)
    .in('status', ['pending', 'parent_buying'])
    .select('id')

  if (approveErr) {
    return NextResponse.json({ error: '처리에 실패했어요' }, { status: 500 })
  }

  if (!updatedRows?.length) {
    return NextResponse.json({ error: '이미 처리됐거나 대기 상태가 아니에요' }, { status: 409 })
  }

  const purchaseQty = typeof request.quantity === 'number' ? request.quantity : 1
  const grantedQty = await grantMarketContentRewardsForPurchaseOnce(supabase, {
    id: request.id as string,
    child_id: childId,
    item_name: request.item_name as string,
    quantity: purchaseQty,
    rewards_granted_at: request.rewards_granted_at as string | null | undefined,
  })

  const isContentRewardItem = isQuantityPurchasableMarketItem(request.item_name as string)
  if (isContentRewardItem && grantedQty == null) {
    console.error('[market/approve] content ticket grant failed', {
      requestId,
      childId,
      itemName: request.item_name,
      quantity: purchaseQty,
    })
  }

  return NextResponse.json({
    status: 'delivered',
    contentRewardGranted: isContentRewardItem ? grantedQty != null : undefined,
  })
}
