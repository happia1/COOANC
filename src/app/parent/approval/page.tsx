/**
 * 부모 승인 탭 — 구매 요청 승인/반려 + 미션 롤백 + 자녀 마켓 메뉴 제어
 */

export const dynamic = 'force-dynamic'
export const preferredRegion = 'hnd1'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCachedParentAuth } from '@/lib/parentServerAuthCache'
import ApprovalTab from '@/components/parent/ApprovalTab'
import { selectChildProfilesByIds } from '@/lib/supabase/childProfileSelect'
import { resolveDisplayAge } from '@/lib/ageFromBirthDate'
import {
  profileAgeGroupShortLabel,
  profileInstitutionLabel,
  resolveProfileAgeGroup,
} from '@/lib/childProfileDisplay'
import type { StoreItem } from '@/types/database'

export default async function ApprovalPage() {
  const auth = await getCachedParentAuth()
  if (!auth?.user) redirect('/login')
  if (!auth.profile || auth.profile.role !== 'parent') redirect('/home')

  const supabase = await createClient()
  const links = auth.familyLinks
  const childIds = links.map((l) => l.child_id)
  const linkByChild = Object.fromEntries(links.map((l) => [l.child_id, l.id]))
  const linkIds = links.map((l) => l.id)

  const profileBundle = childIds.length > 0 ? await selectChildProfilesByIds(supabase, childIds) : { rows: [], error: null }
  if (profileBundle.error) {
    console.error('[parent approval] profiles:', profileBundle.error.message)
  }
  const profiles = profileBundle.rows ?? []

  const [statsRes, requestsRes, historyRes, logsRes, storeRes, hiddenRes, creditOvRes, orderRes] = await Promise.all([
    childIds.length > 0
      ? supabase
          .from('child_stats')
          .select('child_id, current_level, credits, hearts, streak_days')
          .in('child_id', childIds)
      : Promise.resolve({ data: [], error: null }),

    childIds.length > 0
      ? supabase
          .from('purchase_requests')
          .select('*')
          .in('child_id', childIds)
          .in('status', ['pending', 'parent_buying'])
          .order('requested_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),

    /** 승인 내역용: 승인·반려·도착 완료 건(최근 100건) — 구매 요청 블록 하단 */
    childIds.length > 0
      ? supabase
          .from('purchase_requests')
          .select('*')
          .in('child_id', childIds)
          .in('status', ['approved', 'rejected', 'delivered'])
          .order('requested_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [], error: null }),

    childIds.length > 0
      ? supabase
          .from('mission_logs')
          .select('id, child_id, assigned_date, completed_at, credit_earned, heart_earned, exp_earned, missions(title, icon_emoji)')
          .in('child_id', childIds)
          .eq('is_completed', true)
          .order('completed_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [], error: null }),

    (async () => {
      /**
       * 비개발자 설명:
       * - 먼저 "이 부모가 볼 수 있는 상품 범위(전체 공개 + 우리 가족 전용)"만 가져옵니다.
       * - 활성/장난감 필터는 아래에서 JS로 한 번 더 적용합니다.
       */
      if (linkIds.length === 0) {
        return supabase.from('store_items').select('*').is('family_link_id', null)
      }
      return supabase
        .from('store_items')
        .select('*')
        .or(`family_link_id.is.null,family_link_id.in.(${linkIds.join(',')})`)
    })(),

    childIds.length > 0
      ? supabase.from('child_market_hidden_items').select('child_id, store_item_id').in('child_id', childIds)
      : Promise.resolve({ data: [], error: null }),

    childIds.length > 0
      ? supabase
          .from('child_store_item_credit_overrides')
          .select('child_id, store_item_id, credit_price')
          .in('child_id', childIds)
      : Promise.resolve({ data: [], error: null }),

    childIds.length > 0
      ? supabase
          .from('child_market_item_orders')
          .select('child_id, store_item_id, order_rank')
          .in('child_id', childIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  type StatRow = {
    child_id: string
    current_level: number
    credits: number
    hearts: number
    streak_days: number
  }
  const statsMap = Object.fromEntries(((statsRes.data ?? []) as StatRow[]).map((s) => [s.child_id, s]))

  const childrenProfiles = profiles.map((p) => {
    const st = statsMap[p.id]
    const displayAge = resolveDisplayAge(p.birth_date ?? null, p.age)
    const ag = resolveProfileAgeGroup(p.age_group, displayAge)
    return {
      id: p.id,
      name: p.name,
      level: st?.current_level ?? 0,
      credits: st?.credits ?? 0,
      hearts: st?.hearts ?? 0,
      streakDays: st?.streak_days ?? 0,
      age: displayAge,
      avatarUrl: p.avatar_url ?? null,
      institutionType: p.institution_type ?? null,
      ageGroupLabel: profileAgeGroupShortLabel(ag),
      childcareLabel: profileInstitutionLabel(ag, p.institution_type),
    }
  })

  const hiddenItemIdsByChild: Record<string, string[]> = {}
  for (const cid of childIds) {
    hiddenItemIdsByChild[cid] = []
  }
  if (!hiddenRes.error && hiddenRes.data) {
    for (const row of hiddenRes.data as { child_id: string; store_item_id: string }[]) {
      if (!hiddenItemIdsByChild[row.child_id]) hiddenItemIdsByChild[row.child_id] = []
      hiddenItemIdsByChild[row.child_id].push(row.store_item_id)
    }
  } else if (hiddenRes.error) {
    console.warn('[parent approval] child_market_hidden_items:', hiddenRes.error.message)
  }

  /**
   * 비개발자 설명:
   * - 메뉴 제어에는 "활성 상품"을 기본으로 보여 줍니다.
   * - 단, 장난감은 베타 기간 비활성이어도 제어할 수 있어야 해서 항상 포함합니다.
   */
  const storeItems = ((storeRes.data ?? []) as StoreItem[]).filter(
    (item) => item.is_active || item.category === 'toy',
  )

  /** 메뉴 제어에서 쓰는 자녀별 크레딧 덮어쓰기(서버 스냅샷) */
  const initialCreditOverridesByChild: Record<string, Record<string, number>> = {}
  for (const cid of childIds) {
    initialCreditOverridesByChild[cid] = {}
  }
  if (!creditOvRes.error && creditOvRes.data) {
    for (const row of creditOvRes.data as {
      child_id: string
      store_item_id: string
      credit_price: number
    }[]) {
      if (!initialCreditOverridesByChild[row.child_id]) initialCreditOverridesByChild[row.child_id] = {}
      initialCreditOverridesByChild[row.child_id][row.store_item_id] = row.credit_price
    }
  } else if (creditOvRes.error) {
    console.warn('[parent approval] child_store_item_credit_overrides:', creditOvRes.error.message)
  }

  /** 메뉴 제어에서 쓰는 자녀별 상품 순서 스냅샷 */
  const initialItemOrdersByChild: Record<string, Record<string, number>> = {}
  for (const cid of childIds) {
    initialItemOrdersByChild[cid] = {}
  }
  if (!orderRes.error && orderRes.data) {
    for (const row of orderRes.data as {
      child_id: string
      store_item_id: string
      order_rank: number
    }[]) {
      if (!initialItemOrdersByChild[row.child_id]) initialItemOrdersByChild[row.child_id] = {}
      initialItemOrdersByChild[row.child_id][row.store_item_id] = row.order_rank
    }
  } else if (orderRes.error) {
    console.warn('[parent approval] child_market_item_orders:', orderRes.error.message)
  }

  if (historyRes.error) {
    console.warn('[parent approval] purchase_requests history:', historyRes.error.message)
  }

  return (
    <ApprovalTab
      childrenProfiles={childrenProfiles}
      pendingRequests={requestsRes.data ?? []}
      requestHistory={historyRes.data ?? []}
      recentLogs={logsRes.data ?? []}
      storeItems={storeItems}
      linkByChild={linkByChild}
      hiddenItemIdsByChild={hiddenItemIdsByChild}
      initialCreditOverridesByChild={initialCreditOverridesByChild}
      initialItemOrdersByChild={initialItemOrdersByChild}
    />
  )
}
