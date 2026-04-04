/**
 * 아이 앱 마켓 탭 — 서버 컴포넌트
 * - 레벨 조건을 충족한 is_active 상품 목록 조회
 * - 이 아이의 pending 구매 요청 목록 조회
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MarketTab from '@/components/child/MarketTab'
import type { StoreItem, PurchaseRequest } from '@/types/database'

export default async function MarketPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [statsRes, itemsRes, requestsRes] = await Promise.all([
    supabase
      .from('child_stats')
      .select('credits, current_level')
      .eq('child_id', user.id)
      .maybeSingle(),

    supabase
      .from('store_items')
      .select('*')
      .eq('is_active', true)
      .order('credit_price', { ascending: true }),

    supabase
      .from('purchase_requests')
      .select('*')
      .eq('child_id', user.id)
      .in('status', ['pending', 'approved'])
      .order('requested_at', { ascending: false })
      .limit(10),
  ])

  const level = statsRes.data?.current_level ?? 0
  const credits = statsRes.data?.credits ?? 0

  // 레벨 조건 충족 상품만
  const items = ((itemsRes.data ?? []) as StoreItem[]).filter(
    (item) => item.level_required <= level,
  )
  const requests = (requestsRes.data ?? []) as PurchaseRequest[]

  return (
    <MarketTab
      childId={user.id}
      items={items}
      requests={requests}
      credits={credits}
      level={level}
    />
  )
}
