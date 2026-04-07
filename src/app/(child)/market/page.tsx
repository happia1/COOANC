/**
 * 아이 앱 마켓 탭 — 서버 컴포넌트
 * - getActorChildContext 의 자녀 id 로 통계·숨김 상품·구매 요청을 조회합니다.
 * - 부모가 켠/끈 상품은 클라이언트(MarketTab)에서 `child_market_hidden_items` 실시간 구독으로 즉시 반영합니다.
 */
import { createClient } from '@/lib/supabase/server'
import { getActorChildContext } from '@/lib/getActorChildContext'
import MarketTab from '@/components/child/MarketTab'
import { isCategoryExcludedFromMarket } from '@/lib/parentMarketMenuSections'
import type { StoreItem, PurchaseRequest } from '@/types/database'

export default async function MarketPage() {
  const ctx = await getActorChildContext()
  const supabase = await createClient()
  const childId = ctx.actorChildId

  const [statsRes, linksRes, itemsRes, hiddenRes, requestsRes, wishRes] = await Promise.all([
    supabase
      .from('child_stats')
      .select('credits, credits_wallet, credits_piggy, current_level')
      .eq('child_id', childId)
      .maybeSingle(),

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
      .in('status', ['pending', 'parent_buying', 'approved', 'rejected', 'delivered'])
      .order('requested_at', { ascending: false })
      .limit(12),

    supabase.from('market_wishlist_items').select('store_item_id').eq('child_id', childId),
  ])

  const level = statsRes.data?.current_level ?? 0
  const credits = statsRes.data?.credits ?? 0
  const creditsWallet =
    typeof statsRes.data?.credits_wallet === 'number' ? statsRes.data.credits_wallet : 0
  const initialWishlistItemIds = wishRes.error
    ? []
    : (wishRes.data ?? []).map((r: { store_item_id: string }) => r.store_item_id)

  const familyLinkIds = new Set((linksRes.data ?? []).map((r: { id: string }) => r.id))
  const hiddenIds = new Set(
    (hiddenRes.error ? [] : (hiddenRes.data ?? [])).map((r: { store_item_id: string }) => r.store_item_id),
  )

  const rawItems = (itemsRes.data ?? []) as StoreItem[]
  /**
   * 이 자녀 가족에 노출될 수 있는 상품만(전역 + 우리 가족 전용).
   * 부모 「메뉴 제어」숨김은 MarketTab 안에서 `initialHiddenStoreItemIds` 로 걸러집니다.
   */
  const marketEligibleItems = rawItems.filter(
    (item) =>
      !isCategoryExcludedFromMarket(item.category) &&
      (item.family_link_id == null || familyLinkIds.has(item.family_link_id)),
  )
  const initialHiddenStoreItemIds = Array.from(hiddenIds).sort()
  const requests = (requestsRes.data ?? []) as PurchaseRequest[]

  return (
    <MarketTab
      childId={childId}
      marketEligibleItems={marketEligibleItems}
      initialHiddenStoreItemIds={initialHiddenStoreItemIds}
      requests={requests}
      creditsWallet={creditsWallet}
      initialWishlistItemIds={initialWishlistItemIds}
      level={level}
    />
  )
}
