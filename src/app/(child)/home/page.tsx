/**
 * 자녀 앱 단일 화면 — 서버 컴포넌트 (통합 페이지)
 *
 * 기존 home/mission/market 3탭을 ChildScreen 하나로 통합했습니다.
 * 서버 단에서 모든 데이터를 병렬로 가져와 ChildScreen에 props로 전달합니다.
 *
 * 비개발자 설명:
 * - 이 파일은 서버에서 실행되며, 자녀 정보/미션/마켓 데이터를 한 번에 준비합니다.
 * - 준비된 데이터는 ChildScreen 컴포넌트에 넘겨져 화면에 표시됩니다.
 * - API 키 등 민감 정보는 서버에서만 접근합니다(클라이언트에 노출 없음).
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { getCachedProfileRowById, getCachedFamilyLinksForChild } from '@/lib/childAppDataCache'
import { getActorChildContext } from '@/lib/getActorChildContext'
import { getMissionTemplatesForChildMissionPage } from '@/lib/missionsTemplateCache'
import { getSeoulDateString } from '@/lib/koreaDate'
import { uuidStringsEqual } from '@/lib/normalizeUuid'
import { applyStoreItemCreditOverrides } from '@/lib/applyStoreItemCreditOverrides'
import { readChildStatInt } from '@/lib/childCreditsSplit'
import { isCategoryExcludedFromMarket } from '@/lib/parentMarketMenuSections'
import ChildScreen from '@/components/child/ChildScreen'
import type {
  ChildStats,
  DailyMissionWithTemplate,
  Mission,
  PraiseStickerGrant,
  PraiseStickerPlacement,
  StoreItem,
  PurchaseRequest,
  ChildItemUnlock,
} from '@/types/database'

/** 매 요청 최신 데이터로 렌더링 (SSR) */
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const preferredRegion = 'hnd1'

// ─── 미션 관련 헬퍼 (mission/page.tsx 에서 이동) ────────────────────────────

type RoutineType = 'weekday' | 'weekend' | 'holiday' | 'vacation'
type CalEventRow = { start_date: string; end_date: string; routine_override: string }

/** 오늘이 평일/주말/휴일/방학 중 어느 타입인지 판단합니다 */
function getTodayRoutineType(today: string, calendarEvents: CalEventRow[]): RoutineType {
  const ev = calendarEvents.find((e) => today >= e.start_date && today <= e.end_date)
  if (ev) return ev.routine_override === 'none' ? 'holiday' : 'vacation'
  const [yy, mm, dd] = today.split('-').map(Number)
  const dow = new Date(yy, mm - 1, dd).getDay()
  return dow === 0 || dow === 6 ? 'weekend' : 'weekday'
}

/** 오늘 루틴 타입에 맞는 미션 템플릿 풀을 반환합니다 */
function templatePoolForToday(
  templates: Mission[],
  childId: string,
  level: number,
  routineType: RoutineType,
): Mission[] {
  if (routineType === 'holiday') return []

  const linked = templates.filter(
    (m) =>
      m.is_active &&
      m.level_required <= level &&
      uuidStringsEqual(m.linked_child_id, childId) &&
      m.repeat_type !== 'event',
  )
  const dailyOrWeekly = linked.filter((m) => m.repeat_type === 'daily' || m.repeat_type === 'weekly')

  if (routineType === 'weekday') {
    return dailyOrWeekly.filter((m) => m.repeat_type === 'daily')
  }
  const weekly = dailyOrWeekly.filter((m) => m.repeat_type === 'weekly')
  return weekly.length > 0 ? weekly : dailyOrWeekly.filter((m) => m.repeat_type === 'daily')
}

/**
 * 만 나이를 계산합니다.
 * - profiles.age 컬럼이 있으면 그 값을 사용합니다.
 * - 없으면 birth_date로 계산합니다.
 */
function calcAgeYears(
  age: number | null,
  birthDate: string | null,
): number | null {
  if (age !== null) return age
  if (!birthDate) return null
  try {
    const today = new Date()
    const birth = new Date(birthDate)
    const ageYears = Math.floor((today.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    return ageYears >= 0 ? ageYears : null
  } catch {
    return null
  }
}

// ────────────────────────────────────────────────────────────────────────────

export default async function ChildHomePage() {
  /** 자녀 컨텍스트 + Supabase 클라이언트를 동시에 준비 */
  const [ctx, supabase] = await Promise.all([getActorChildContext(), createClient()])
  const childId = ctx.actorChildId
  const today = getSeoulDateString()

  const serviceRoleClient = createServiceRoleClient()
  const missionDb = serviceRoleClient ?? supabase

  /**
   * 미션 템플릿은 캐시(60초)로 읽어 자주 바뀌지 않는 데이터를 반복 조회하지 않습니다.
   */
  const templatesQuery =
    serviceRoleClient != null
      ? getMissionTemplatesForChildMissionPage()
      : missionDb.from('missions').select('*').order('scheduled_time', { ascending: true, nullsFirst: false })

  /** missions JOIN 필드 — 미션 완료 API 와 같은 필드를 요청해 캐시를 공유합니다 */
  const missionJoin =
    'title, icon_emoji, description, credit_reward, heart_reward, exp_reward, reward_multiplier, difficulty, block, repeat_type'

  /**
   * 1단계: childId 만 알면 되는 병렬 조회
   * - child_stats, profile(이름+아바타+나이), family_links, 스티커 grants/placements, 미션 템플릿,
   *   꾸미기 아이템 해금, 마켓 숨김/위시리스트/크레딧 오버라이드 를 한 번에 가져옵니다.
   */
  const [
    statsRes,
    profileRow,
    ageProfileRes,
    familyRows,
    grantsRes,
    placementsRes,
    itemUnlocksRes,
    templatesRes,
    hiddenRes,
    wishRes,
    creditOvRes,
    itemsRes,
    requestsRes,
  ] = await Promise.all([
    supabase.from('child_stats').select('*').eq('child_id', childId).maybeSingle(),
    getCachedProfileRowById(childId),
    /** 나이 정보(age, birth_date)는 CachedChildProfileRow에 없어 별도로 조회 */
    supabase.from('profiles').select('age, birth_date').eq('id', childId).maybeSingle(),
    getCachedFamilyLinksForChild(childId),
    supabase
      .from('praise_sticker_grants')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false }),
    supabase.from('praise_sticker_placements').select('*').eq('child_id', childId),
    supabase.from('child_item_unlocks').select('item_index').eq('child_id', childId),
    templatesQuery,
    supabase.from('child_market_hidden_items').select('store_item_id').eq('child_id', childId),
    supabase.from('market_wishlist_items').select('store_item_id, quantity').eq('child_id', childId),
    supabase
      .from('child_store_item_credit_overrides')
      .select('store_item_id, credit_price')
      .eq('child_id', childId),
    supabase
      .from('store_items')
      .select('*')
      .eq('is_active', true)
      .order('credit_price', { ascending: true }),
    supabase
      .from('purchase_requests')
      .select('*')
      .eq('child_id', childId)
      .in('status', ['pending', 'parent_buying', 'approved', 'rejected', 'delivered'])
      .order('requested_at', { ascending: false })
      .limit(12),
  ])

  // ── 기본 자녀 정보 ────────────────────────────────────────────────────────

  const initialStats = (statsRes.data ?? null) as ChildStats | null
  const level = initialStats?.current_level ?? 0
  const creditsWallet = readChildStatInt(initialStats?.credits_wallet)

  const childName = (profileRow?.name ?? '').trim() || '쿠앵이'
  const childAvatarUrl =
    typeof profileRow?.avatar_url === 'string' ? profileRow.avatar_url.trim() || null : null

  /** 만 나이 계산 — profiles.age 또는 birth_date 사용 */
  const ageData = ageProfileRes.data as { age: number | null; birth_date: string | null } | null
  const ageYears = calcAgeYears(ageData?.age ?? null, ageData?.birth_date ?? null)

  // ── 스티커 ───────────────────────────────────────────────────────────────

  const praiseGrants = (grantsRes.data ?? []) as PraiseStickerGrant[]
  const praisePlacements = (placementsRes.data ?? []) as PraiseStickerPlacement[]
  const unlockedItemIndexes = (
    (itemUnlocksRes.data ?? []) as Pick<ChildItemUnlock, 'item_index'>[]
  ).map((r) => r.item_index)

  // ── 미션 ─────────────────────────────────────────────────────────────────

  const parentId = familyRows[0]?.parent_id ?? null

  /**
   * 2단계: calendar_events (parentId 필요)와 오늘 daily_missions 를 병렬 조회
   */
  const [calRes, dailyMissionsRes] = await Promise.all([
    parentId != null
      ? missionDb
          .from('calendar_events')
          .select('start_date, end_date, routine_override')
          .eq('parent_id', parentId)
          .lte('start_date', today)
          .gte('end_date', today)
          .limit(5)
      : Promise.resolve({ data: [] as CalEventRow[], error: null }),
    missionDb
      .from('daily_missions')
      .select(`*, missions(${missionJoin})`)
      .eq('child_id', childId)
      .eq('date', today)
      .order('scheduled_time', { ascending: true, nullsFirst: false }),
  ])

  const calEvents = calRes.data ?? []
  const routineType = getTodayRoutineType(today, calEvents)

  if (templatesRes.error) {
    console.error('[child/home] missions select', templatesRes.error.message)
  }

  const pool = templatePoolForToday(
    (templatesRes.data ?? []) as Mission[],
    childId,
    level,
    routineType,
  )

  /**
   * 오늘 행이 없을 때만 백필 삽입합니다 (대부분의 요청은 건너뜀).
   */
  let { data: existingRows, error: existingErr } = dailyMissionsRes
  if (existingErr) console.error('[child/home] daily_missions select', existingErr.message)

  let existing = (existingRows ?? []) as DailyMissionWithTemplate[]
  console.log('[home] today=', today, 'existing=', existing.length, 'pool=', pool.length)

  if (existing.length === 0 && pool.length > 0) {
    await Promise.all(
      pool.map(async (m) => {
        const row = {
          child_id: childId,
          mission_template_id: m.id,
          date: today,
          scheduled_time: m.scheduled_time ?? null,
          routine_type: routineType,
          is_completed: false,
        }
        const { error } = await missionDb.from('daily_missions').insert(row)
        if (error && error.code !== '23505') {
          console.error('[child/home] daily_missions insert', error)
        }
      }),
    )
    const refetch = await missionDb
      .from('daily_missions')
      .select(`*, missions(${missionJoin})`)
      .eq('child_id', childId)
      .eq('date', today)
      .order('scheduled_time', { ascending: true, nullsFirst: false })
    if (refetch.error) console.error('[child/home] daily_missions refetch', refetch.error.message)
    existing = (refetch.data ?? []) as DailyMissionWithTemplate[]
  }

  const dailyMissions = existing

  // ── 마켓 ─────────────────────────────────────────────────────────────────

  const familyLinkIds = new Set(familyRows.map((r) => r.id))
  const hiddenIds = new Set(
    (hiddenRes.error ? [] : (hiddenRes.data ?? [])).map(
      (r: { store_item_id: string }) => r.store_item_id,
    ),
  )

  const creditOverrides: Record<string, number> = {}
  if (!creditOvRes.error && creditOvRes.data) {
    for (const row of creditOvRes.data as { store_item_id: string; credit_price: number }[]) {
      creditOverrides[row.store_item_id] = row.credit_price
    }
  }

  const rawItems = (itemsRes.data ?? []) as StoreItem[]
  const filtered = rawItems.filter(
    (item) =>
      !isCategoryExcludedFromMarket(item.category) &&
      (item.family_link_id == null || familyLinkIds.has(item.family_link_id)),
  )
  const marketEligibleItems = applyStoreItemCreditOverrides(filtered, creditOverrides)
  const initialHiddenStoreItemIds = Array.from(hiddenIds).sort()
  const marketRequests = (requestsRes.data ?? []) as PurchaseRequest[]
  const initialWishlistEntries = wishRes.error
    ? []
    : (wishRes.data ?? []).map((r: { store_item_id: string; quantity?: number | null }) => ({
        storeItemId: r.store_item_id,
        quantity: typeof r.quantity === 'number' && r.quantity > 0 ? r.quantity : 1,
      }))

  // ── exitHref ─────────────────────────────────────────────────────────────

  const exitHref = ctx.isParentPreview ? '/api/parent/exit-child-ui' : '/parent/home'

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <ChildScreen
      childId={childId}
      childName={childName}
      ageYears={ageYears}
      childAvatarUrl={childAvatarUrl}
      initialStats={initialStats}
      dailyMissions={dailyMissions}
      today={today}
      initialPraiseGrants={praiseGrants}
      initialPraisePlacements={praisePlacements}
      marketEligibleItems={marketEligibleItems}
      initialHiddenStoreItemIds={initialHiddenStoreItemIds}
      marketRequests={marketRequests}
      initialWishlistEntries={initialWishlistEntries}
      initialUnlockedItemIndexes={unlockedItemIndexes}
      exitHref={exitHref}
    />
  )
}
