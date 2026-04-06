/**
 * 아이 앱 마켓 탭 — 서버 컴포넌트
 * - getActorChildContext 의 자녀 id 로 통계·숨김 상품·구매 요청을 조회합니다.
 */
import { createClient } from '@/lib/supabase/server'
import { getActorChildContext } from '@/lib/getActorChildContext'
import MarketTab from '@/components/child/MarketTab'
import type { StoreItem, PurchaseRequest } from '@/types/database'

export default async function MarketPage() {
  const ctx = await getActorChildContext()
  const supabase = await createClient()
  const childId = ctx.actorChildId

  const [statsRes, linksRes, itemsRes, hiddenRes, requestsRes] = await Promise.all([
    supabase.from('child_stats').select('credits, current_level').eq('child_id', childId).maybeSingle(),

    supabase.from('family_links').select('id').eq('child_id', childId),

    supabase
      .from('store_items')
      .select('*')
      .eq('is_active', true)
      .order('credit_price', { ascending: true }),

    supabase.from('child_market_hidden_items').select('store_item_id').eq('child_id', childId),

    supabase
      .from('purchase_requests')
      .select('*')
      .eq('child_id', childId)
      .in('status', ['pending', 'approved'])
      .order('requested_at', { ascending: false })
      .limit(10),
  ])

  const level = statsRes.data?.current_level ?? 0
  const credits = statsRes.data?.credits ?? 0

  const familyLinkIds = new Set((linksRes.data ?? []).map((r: { id: string }) => r.id))
  const hiddenIds = new Set(
    (hiddenRes.error ? [] : (hiddenRes.data ?? [])).map((r: { store_item_id: string }) => r.store_item_id),
  )

  const rawItems = (itemsRes.data ?? []) as StoreItem[]
  const items = rawItems.filter(
    (item) =>
      !hiddenIds.has(item.id) &&
      item.level_required <= level &&
      (item.family_link_id == null || familyLinkIds.has(item.family_link_id)),
  )
  const requests = (requestsRes.data ?? []) as PurchaseRequest[]

  return (
    <MarketTab childId={childId} items={items} requests={requests} credits={credits} level={level} />
  )
}
