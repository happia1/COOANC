import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import { isCategoryExcludedFromMarket } from '@/lib/parentMarketMenuSections'
import { fireGameTrigger } from '@/lib/gameLayer/fireGameTrigger'

/**
 * POST /api/market/wishlist — body:
 *   { action: 'add'|'remove', storeItemId, childId? }
 *   { action: 'set_quantity', storeItemId, quantity, childId? }
 * GET  /api/market/wishlist?childId= — 위시리스트 store_item_id + quantity 목록
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
    .select('store_item_id, quantity')
    .eq('child_id', resolved.childId)
    .order('created_at', { ascending: false })

  if (error?.code === '42703') {
    // quantity 컬럼이 아직 없는 구버전 스키마 호환: 수량은 모두 1로 간주
    const { data: legacyRows, error: legacyErr } = await supabase
      .from('market_wishlist_items')
      .select('store_item_id')
      .eq('child_id', resolved.childId)
      .order('created_at', { ascending: false })
    if (legacyErr) return NextResponse.json({ error: '목록을 불러오지 못했어요' }, { status: 500 })
    return NextResponse.json({
      items: (legacyRows ?? []).map((r: { store_item_id: string }) => ({
        store_item_id: r.store_item_id,
        quantity: 1,
      })),
    })
  }

  if (error) return NextResponse.json({ error: '목록을 불러오지 못했어요' }, { status: 500 })
  return NextResponse.json({
    items: (data ?? []).map((r: { store_item_id: string; quantity?: number | null }) => ({
      store_item_id: r.store_item_id,
      quantity: typeof r.quantity === 'number' && r.quantity > 0 ? r.quantity : 1,
    })),
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  let action: unknown
  let storeItemId: unknown
  let quantity: unknown
  let bodyChildId: unknown
  try {
    const body = await req.json()
    action = body.action
    storeItemId = body.storeItemId
    quantity = body.quantity
    bodyChildId = body.childId
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (action !== 'add' && action !== 'remove' && action !== 'set_quantity') {
    return NextResponse.json({ error: 'action 이 필요해요' }, { status: 400 })
  }
  if (typeof storeItemId !== 'string' || !storeItemId) {
    return NextResponse.json({ error: '상품 정보가 필요해요' }, { status: 400 })
  }

  const resolved = await resolveApiActorChildId(supabase, user, bodyChildId)
  if (resolved.ok === false) return resolved.response
  const childId = resolved.childId
  if (action === 'set_quantity') {
    if (!Number.isInteger(quantity) || Number(quantity) < 1) {
      return NextResponse.json({ error: '수량은 1 이상 정수여야 해요' }, { status: 400 })
    }
    const nextQty = Number(quantity)
    const { error: updErr } = await supabase
      .from('market_wishlist_items')
      .update({ quantity: nextQty })
      .eq('child_id', childId)
      .eq('store_item_id', storeItemId)

    if (updErr?.code === '42703' || updErr?.code === 'PGRST204') {
      // 구버전 스키마에서는 수량 열이 없어 서버 저장은 불가.
      // UX 오류를 막기 위해 하위호환 성공 응답으로 내려 클라이언트에서 수량 상태를 유지합니다.
      return NextResponse.json({ ok: true, quantity: nextQty, degraded: true })
    }

    if (updErr) {
      return NextResponse.json({ error: '수량 변경에 실패했어요' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, quantity: nextQty })
  }

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

    const { data: existing, error: selErr } = await supabase
      .from('market_wishlist_items')
      .select('id, quantity')
      .eq('child_id', childId)
      .eq('store_item_id', storeItemId)
      .maybeSingle()
    if (selErr?.code === '42703') {
      // quantity 컬럼이 아직 없는 구버전 스키마 호환 경로
      const { error: legacyInsertErr } = await supabase.from('market_wishlist_items').insert({
        child_id: childId,
        store_item_id: storeItemId,
      })
      if (legacyInsertErr) {
        if (legacyInsertErr.code === '23505') {
          // 이미 담긴 상품이면 구버전에서는 수량 개념이 없으므로 성공으로 처리
          return NextResponse.json({ ok: true, quantity: 1, duplicate: true })
        }
        return NextResponse.json({ error: '담기에 실패했어요' }, { status: 500 })
      }
      return NextResponse.json({ ok: true, quantity: 1 })
    }
    if (selErr) {
      return NextResponse.json({ error: '장바구니 조회에 실패했어요' }, { status: 500 })
    }

    if (existing) {
      const nextQty = (typeof existing.quantity === 'number' ? existing.quantity : 1) + 1
      const { error: updErr } = await supabase
        .from('market_wishlist_items')
        .update({ quantity: nextQty })
        .eq('id', existing.id)
      if (updErr) {
        return NextResponse.json({ error: '수량 증가에 실패했어요' }, { status: 500 })
      }
      return NextResponse.json({ ok: true, quantity: nextQty })
    }

    const { error } = await supabase.from('market_wishlist_items').insert({
      child_id: childId,
      store_item_id: storeItemId,
      quantity: 1,
    })

    if (error) return NextResponse.json({ error: '담기에 실패했어요' }, { status: 500 })

    // ── 게임 트리거: 첫 장바구니 담기 ──
    const triggerResult = await fireGameTrigger(supabase, childId, 'ADD_TO_CART')
    return NextResponse.json({
      ok: true,
      quantity: 1,
      itemUnlocked: triggerResult.fired && triggerResult.unlockedItemIndex !== null
        ? { index: triggerResult.unlockedItemIndex, triggerKey: 'ADD_TO_CART' }
        : null,
    })
  }

  const { error: delErr } = await supabase
    .from('market_wishlist_items')
    .delete()
    .eq('child_id', childId)
    .eq('store_item_id', storeItemId)

  if (delErr) return NextResponse.json({ error: '빼기에 실패했어요' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
