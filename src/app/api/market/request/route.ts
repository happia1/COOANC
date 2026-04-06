import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'

/**
 * POST /api/market/request
 * body: { itemId, childMessage?, childId? }
 * - 자녀 본인: childId 생략 시 본인 계정으로 처리
 * - 부모가 자녀 마켓을 볼 때: childId 로 연결된 자녀만 차감·요청 생성
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  let itemId: string
  let childMessage: string | null
  let bodyChildId: unknown
  try {
    const body = await req.json()
    itemId = body.itemId
    childMessage = body.childMessage ?? null
    bodyChildId = body.childId
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!itemId) {
    return NextResponse.json({ error: '상품 정보가 누락됐어요' }, { status: 400 })
  }

  const resolved = await resolveApiActorChildId(supabase, user, bodyChildId)
  if (resolved.ok === false) {
    return resolved.response
  }
  const childId = resolved.childId

  // 상품 조회
  const { data: item } = await supabase
    .from('store_items')
    .select('*')
    .eq('id', itemId)
    .eq('is_active', true)
    .maybeSingle()

  if (!item) {
    return NextResponse.json({ error: '상품을 찾을 수 없어요' }, { status: 404 })
  }

  // 스탯 조회
  const { data: stats } = await supabase
    .from('child_stats')
    .select('credits, current_level')
    .eq('child_id', childId)
    .maybeSingle()

  if (!stats) {
    return NextResponse.json({ error: '스탯 정보를 찾을 수 없어요' }, { status: 404 })
  }

  if (stats.credits < item.credit_price) {
    return NextResponse.json({ error: '크레딧이 부족해요' }, { status: 400 })
  }

  if (stats.current_level < item.level_required) {
    return NextResponse.json({ error: '레벨이 부족해요' }, { status: 400 })
  }

  // 이미 pending 요청이 있는지 확인
  const { data: existing } = await supabase
    .from('purchase_requests')
    .select('id')
    .eq('child_id', childId)
    .eq('item_id', itemId)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: '이미 요청 중인 상품이에요' }, { status: 409 })
  }

  // 크레딧 차감
  const { error: deductErr } = await supabase
    .from('child_stats')
    .update({
      credits: stats.credits - item.credit_price,
      updated_at: new Date().toISOString(),
    })
    .eq('child_id', childId)

  if (deductErr) {
    return NextResponse.json({ error: '크레딧 차감에 실패했어요' }, { status: 500 })
  }

  // 구매 요청 생성
  const { data: request, error: insertErr } = await supabase
    .from('purchase_requests')
    .insert({
      child_id: childId,
      item_id: itemId,
      item_name: item.name,
      item_price: item.credit_price,
      item_type: item.item_type,
      status: 'pending',
      child_message: childMessage,
      requested_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (insertErr) {
    // 삽입 실패 시 크레딧 환불
    await supabase
      .from('child_stats')
      .update({ credits: stats.credits })
      .eq('child_id', childId)
    return NextResponse.json({ error: '요청 생성에 실패했어요. 다시 시도해 주세요.' }, { status: 500 })
  }

  return NextResponse.json({ request }, { status: 201 })
}
