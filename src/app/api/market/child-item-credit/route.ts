import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isCategoryExcludedFromMarket } from '@/lib/parentMarketMenuSections'

/**
 * POST /api/market/child-item-credit
 * body: { childId, storeItemId, creditPrice }
 * - 연결된 부모만 호출합니다.
 * - creditPrice 가 DB 기본 가격과 같으면 덮어쓰기 행을 지워 기본값으로 돌립니다.
 * - 다르면 child_store_item_credit_overrides 에 upsert 합니다.
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
    return NextResponse.json({ error: '부모 계정만 바꿀 수 있어요' }, { status: 403 })
  }

  let childId: string
  let storeItemId: string
  let creditPriceRaw: unknown
  try {
    const body = await req.json()
    childId = typeof body.childId === 'string' ? body.childId.trim() : ''
    storeItemId = typeof body.storeItemId === 'string' ? body.storeItemId.trim() : ''
    creditPriceRaw = body.creditPrice
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!childId || !storeItemId) {
    return NextResponse.json({ error: '자녀·상품 정보가 필요해요' }, { status: 400 })
  }

  const creditPrice = Math.floor(Number(creditPriceRaw))
  if (!Number.isFinite(creditPrice) || creditPrice < 0 || creditPrice > 999_999) {
    return NextResponse.json({ error: '크레딧은 0~999999 사이로 입력해 주세요' }, { status: 400 })
  }

  const { data: link, error: linkErr } = await supabase
    .from('family_links')
    .select('id')
    .eq('parent_id', user.id)
    .eq('child_id', childId)
    .maybeSingle()

  if (linkErr || !link) {
    return NextResponse.json({ error: '연결된 자녀만 설정할 수 있어요' }, { status: 403 })
  }

  const { data: item, error: itemErr } = await supabase
    .from('store_items')
    .select('id, credit_price, family_link_id, category, is_active')
    .eq('id', storeItemId)
    .maybeSingle()

  if (itemErr || !item?.is_active) {
    return NextResponse.json({ error: '상품을 찾을 수 없어요' }, { status: 404 })
  }

  if (item.family_link_id != null && item.family_link_id !== link.id) {
    return NextResponse.json({ error: '이 상품은 설정할 수 없어요' }, { status: 403 })
  }

  if (isCategoryExcludedFromMarket(item.category)) {
    return NextResponse.json({ error: '이 상품은 마켓 메뉴에 없어요' }, { status: 400 })
  }

  const base = typeof item.credit_price === 'number' ? item.credit_price : 0

  if (creditPrice === base) {
    const { error: delErr } = await supabase
      .from('child_store_item_credit_overrides')
      .delete()
      .eq('child_id', childId)
      .eq('store_item_id', storeItemId)

    if (delErr) {
      console.error('[child-item-credit] delete', delErr.message)
      return NextResponse.json({ error: '저장하지 못했어요' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, creditPrice: base, usedOverride: false })
  }

  const { error: upErr } = await supabase.from('child_store_item_credit_overrides').upsert(
    {
      child_id: childId,
      store_item_id: storeItemId,
      credit_price: creditPrice,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'child_id,store_item_id' },
  )

  if (upErr) {
    console.error('[child-item-credit] upsert', upErr.message)
    return NextResponse.json({ error: '저장하지 못했어요' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, creditPrice, usedOverride: true })
}
