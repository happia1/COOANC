import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import { applyStoreItemCreditOverrides } from '@/lib/applyStoreItemCreditOverrides'
import { isCategoryExcludedFromMarket } from '@/lib/parentMarketMenuSections'
import { fetchChildHomeContentZoneData } from '@/lib/fetchChildHomeContentZone'
import type { StoreItem } from '@/types/database'

export async function GET(req: NextRequest) {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })
  const resolved = await resolveApiActorChildId(db, user, req.nextUrl.searchParams.get('childId'))
  if (resolved.ok === false) return resolved.response
  const childId = resolved.childId
  const panel = req.nextUrl.searchParams.get('panel')
  const json = (data: unknown) => NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } })
  try {
    if (panel === 'market') {
      const results = await Promise.all([
        db.from('store_items').select('*').eq('is_active', true).order('credit_price'),
        db.from('child_market_hidden_items').select('store_item_id').eq('child_id', childId),
        db.from('child_store_item_credit_overrides').select('store_item_id,credit_price').eq('child_id', childId),
        db.from('family_links').select('id').eq('child_id', childId),
        db.from('purchase_requests').select('*').eq('child_id', childId)
          .in('status', ['pending','parent_buying','approved','rejected','delivered']).order('requested_at', { ascending: false }).limit(12),
      ])
      if (results.some((r) => r.error)) throw new Error('market query failed')
      const [items, hidden, prices, family, requests] = results
      const familyIds = new Set((family.data ?? []).map((r) => r.id))
      const overrides = Object.fromEntries((prices.data ?? []).map((r) => [r.store_item_id,r.credit_price]))
      return json({ items: applyStoreItemCreditOverrides((items.data as StoreItem[]).filter((item) =>
        !isCategoryExcludedFromMarket(item.category) && (item.family_link_id == null || familyIds.has(item.family_link_id))),overrides),
        hiddenIds: (hidden.data ?? []).map((r) => r.store_item_id), requests: requests.data })
    }
    if (panel === 'sticker') {
      const [grants, placements] = await Promise.all([
        db.from('praise_sticker_grants').select('*').eq('child_id', childId).order('created_at', { ascending: false }),
        db.from('praise_sticker_placements').select('*').eq('child_id', childId),
      ])
      if (grants.error || placements.error) throw new Error('sticker query failed')
      return json({ grants: grants.data, placements: placements.data })
    }
    if (panel === 'dressup') {
      const { data, error } = await db.from('child_item_unlocks').select('item_index').eq('child_id', childId)
      if (error) throw error
      return json({ unlocks: (data ?? []).map((r) => r.item_index) })
    }
    if (panel === 'content') return json(await fetchChildHomeContentZoneData(db, childId, true))
    return NextResponse.json({ error: '지원하지 않는 화면이에요' }, { status: 400 })
  } catch (error) {
    console.error('[panel-data]', panel, error)
    return NextResponse.json({ error: '화면 데이터를 불러오지 못했어요' }, { status: 503 })
  }
}
