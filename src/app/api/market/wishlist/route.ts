import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import { isCategoryExcludedFromMarket } from '@/lib/parentMarketMenuSections'

function debugLog(runId: string, hypothesisId: string, location: string, message: string, data: Record<string, unknown>) {
  // #region agent log
  fetch('http://127.0.0.1:7447/ingest/9dd0682d-d3af-41fb-8d82-be18fff89b7a', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '9263e0' },
    body: JSON.stringify({
      sessionId: '9263e0',
      runId,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion
}

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
  debugLog('pre-fix', 'H1-H5', 'wishlist.route.ts:POST:entry', 'wishlist POST received', {
    action,
    storeItemId: typeof storeItemId === 'string' ? storeItemId : 'invalid',
    quantity: typeof quantity === 'number' ? quantity : null,
    childId,
  })

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

    if (updErr) {
      debugLog('pre-fix', 'H2-H3', 'wishlist.route.ts:POST:set_quantity', 'set_quantity failed', {
        code: updErr.code ?? null,
        message: updErr.message ?? 'unknown',
      })
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
    if (selErr) {
      debugLog('pre-fix', 'H1-H2', 'wishlist.route.ts:POST:add:select', 'wishlist select failed', {
        code: selErr.code ?? null,
        message: selErr.message ?? 'unknown',
      })
      return NextResponse.json({ error: '장바구니 조회에 실패했어요' }, { status: 500 })
    }

    if (existing) {
      const nextQty = (typeof existing.quantity === 'number' ? existing.quantity : 1) + 1
      const { error: updErr } = await supabase
        .from('market_wishlist_items')
        .update({ quantity: nextQty })
        .eq('id', existing.id)
      if (updErr) {
        debugLog('pre-fix', 'H2-H3', 'wishlist.route.ts:POST:add:update', 'quantity increment failed', {
          code: updErr.code ?? null,
          message: updErr.message ?? 'unknown',
        })
        return NextResponse.json({ error: '수량 증가에 실패했어요' }, { status: 500 })
      }
      return NextResponse.json({ ok: true, quantity: nextQty })
    }

    const { error } = await supabase.from('market_wishlist_items').insert({
      child_id: childId,
      store_item_id: storeItemId,
      quantity: 1,
    })

    if (error) {
      debugLog('pre-fix', 'H1-H3', 'wishlist.route.ts:POST:add:insert', 'wishlist insert failed', {
        code: error.code ?? null,
        message: error.message ?? 'unknown',
      })
      return NextResponse.json({ error: '담기에 실패했어요' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, quantity: 1 })
  }

  const { error: delErr } = await supabase
    .from('market_wishlist_items')
    .delete()
    .eq('child_id', childId)
    .eq('store_item_id', storeItemId)

  if (delErr) {
    debugLog('pre-fix', 'H4', 'wishlist.route.ts:POST:remove', 'wishlist remove failed', {
      code: delErr.code ?? null,
      message: delErr.message ?? 'unknown',
    })
    return NextResponse.json({ error: '빼기에 실패했어요' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
