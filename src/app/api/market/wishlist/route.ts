import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import { isCategoryExcludedFromMarket } from '@/lib/parentMarketMenuSections'

/**
 * POST /api/market/wishlist — body: { action: 'add'|'remove', storeItemId, childId? }
 * GET  /api/market/wishlist?childId= — 위시리스트 store_item_id 목록
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('childId')
  const resolved = await resolveApiActorChildId(supabase, user, q)
  if (resolved.ok === false) return resolved.response

  const { data, error } = await supabase
    .from('market_wishlist_items')
    .select('store_item_id')
    .eq('child_id', resolved.childId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: '목록을 불러오지 못했어요' }, { status: 500 })
  return NextResponse.json({ itemIds: (data ?? []).map((r: { store_item_id: string }) => r.store_item_id) })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  let action: unknown
  let storeItemId: unknown
  let bodyChildId: unknown
  try {
    const body = await req.json()
    action = body.action
    storeItemId = body.storeItemId
    bodyChildId = body.childId
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (action !== 'add' && action !== 'remove') {
    return NextResponse.json({ error: 'action 이 필요해요' }, { status: 400 })
  }
  if (typeof storeItemId !== 'string' || !storeItemId) {
    return NextResponse.json({ error: '상품 정보가 필요해요' }, { status: 400 })
  }

  const resolved = await resolveApiActorChildId(supabase, user, bodyChildId)
  if (resolved.ok === false) return resolved.response
  const childId = resolved.childId

  if (action === 'add') {
    const { data: item } = await supabase
      .from('store_items')
      .select('id, category, is_active')
      .eq('id', storeItemId)
      .maybeSingle()

    if (!item?.is_active) {
      return NextResponse.json({ error: '상품을 찾을 수 없어요' }, { status: 404 })
    }
    if (isCategoryExcludedFromMarket(item.category)) {
      return NextResponse.json({ error: '이 상품은 담을 수 없어요' }, { status: 400 })
    }

    const { error } = await supabase.from('market_wishlist_items').insert({
      child_id: childId,
      store_item_id: storeItemId,
    })

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ ok: true, duplicate: true })
      }
      return NextResponse.json({ error: '담기에 실패했어요' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  const { error: delErr } = await supabase
    .from('market_wishlist_items')
    .delete()
    .eq('child_id', childId)
    .eq('store_item_id', storeItemId)

  if (delErr) return NextResponse.json({ error: '빼기에 실패했어요' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
