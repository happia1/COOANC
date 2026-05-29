import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isCategoryExcludedFromMarket } from '@/lib/parentMarketMenuSections'

/**
 * POST /api/market/child-item-order
 * body: { childId, orderedItemIds: string[] }
 *
 * 비개발자 설명:
 * - 부모가 메뉴 제어에서 바꾼 상품 순서를 자녀 단위로 저장합니다.
 * - 여기서 저장한 순서는 child_market_item_orders 테이블에 기록됩니다.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 저장할 수 있어요' }, { status: 403 })
  }

  let childId = ''
  let orderedItemIds: string[] = []
  try {
    const body = await req.json()
    childId = typeof body.childId === 'string' ? body.childId.trim() : ''
    orderedItemIds = Array.isArray(body.orderedItemIds)
      ? body.orderedItemIds.filter((v): v is string => typeof v === 'string' && v.trim() !== '').map((v) => v.trim())
      : []
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!childId) {
    return NextResponse.json({ error: '자녀 정보가 필요해요' }, { status: 400 })
  }
  if (orderedItemIds.length === 0) {
    return NextResponse.json({ error: '순서 정보가 비어 있어요' }, { status: 400 })
  }

  const uniqueIds = Array.from(new Set(orderedItemIds))

  const { data: link, error: linkErr } = await supabase
    .from('family_links')
    .select('id')
    .eq('parent_id', user.id)
    .eq('child_id', childId)
    .maybeSingle()

  if (linkErr || !link) {
    return NextResponse.json({ error: '연결된 자녀만 설정할 수 있어요' }, { status: 403 })
  }

  const { data: items, error: itemsErr } = await supabase
    .from('store_items')
    .select('id, family_link_id, category')
    .in('id', uniqueIds)

  if (itemsErr || !items) {
    return NextResponse.json({ error: '상품을 확인하지 못했어요' }, { status: 500 })
  }

  const validIdSet = new Set(
    items
      .filter((it) => {
        if (isCategoryExcludedFromMarket(it.category)) return false
        if (it.family_link_id == null) return true
        return it.family_link_id === link.id
      })
      .map((it) => it.id),
  )

  const filteredIds = uniqueIds.filter((id) => validIdSet.has(id))
  if (filteredIds.length === 0) {
    return NextResponse.json({ error: '저장 가능한 상품이 없어요' }, { status: 400 })
  }

  const rows = filteredIds.map((itemId, idx) => ({
    child_id: childId,
    store_item_id: itemId,
    order_rank: idx,
    updated_at: new Date().toISOString(),
  }))

  const { error: upErr } = await supabase
    .from('child_market_item_orders')
    .upsert(rows, { onConflict: 'child_id,store_item_id' })

  if (upErr) {
    console.error('[child-item-order] upsert', upErr.message)
    return NextResponse.json({ error: '순서를 저장하지 못했어요' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, savedCount: rows.length })
}
