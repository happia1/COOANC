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
import { applyStoreItemCreditOverrides } from '@/lib/applyStoreItemCreditOverrides'
import { readChildStatInt } from '@/lib/childCreditsSplit'
import { isCategoryExcludedFromMarket } from '@/lib/parentMarketMenuSections'
import { fetchCalendarEventsForChildRoutine, fetchDailyRoutineOverride, resolveRoutineTypeForDay } from '@/lib/childRoutineCalendar'
import { fetchChildHomeContentZoneData, EMPTY_CHILD_HOME_CONTENT_ZONE } from '@/lib/fetchChildHomeContentZone'
import { CONTENT_ZONE_UNLOCK_MIN_LEVEL } from '@/constants/childScreenFeatures'
import {
  filterDailyMissionsByTemplatePool,
  templatePoolForMissionDay,
  type MissionDayRoutineType,
} from '@/lib/missionDayTemplatePool'
import ChildHomeScreenClient from '@/components/child/ChildHomeScreenClient'
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

// ─── 미션 관련 헬퍼 ────────────────────────────────────────────────────────

/**
 * DB에 `missions.sort_order` 컬럼이 아직 반영되지 않은 환경(마이그레이션 미적용)에서도
 * 자녀 홈이 깨지지 않도록, 에러 메시지로 컬럼 부재 여부를 판단합니다.
 */
function isMissingSortOrderColumn(message: string | undefined): boolean {
  if (!message) return false
  return /missions\.sort_order/i.test(message) && /does not exist/i.test(message)
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
   * 미션 템플릿은 캐시 없이 매 요청 조회합니다(루틴 저장 직후에도 최신 id 로 백필되게).
   */
  /**
   * 미션 JOIN 필드:
   * - 기본 필드는 항상 요청
   * - sort_order는 컬럼이 있는 환경에서만 요청(없으면 자동 폴백)
   */
  const missionJoinBase =
    'title, icon_emoji, description, credit_reward, heart_reward, exp_reward, reward_multiplier, difficulty, block, repeat_type'
  const missionJoinWithSort = `${missionJoinBase}, sort_order`

  const templatesQuery = (async () => {
    const run = async () => {
      if (serviceRoleClient != null) {
        return getMissionTemplatesForChildMissionPage()
      }
      const withSort = await missionDb
        .from('missions')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('scheduled_time', { ascending: true, nullsFirst: false })
      if (!isMissingSortOrderColumn(withSort.error?.message)) return withSort

      console.warn('[child/home] sort_order missing, fallback templates query')
      return missionDb
        .from('missions')
        .select('*')
        .order('scheduled_time', { ascending: true, nullsFirst: false })
    }

    let res = await run()
    const errMsg =
      'error' in res && res.error && typeof res.error === 'object' && 'message' in res.error
        ? String((res.error as { message?: string }).message ?? '')
        : res.error?.message ?? ''
    if (errMsg.includes('fetch failed')) {
      await new Promise((r) => setTimeout(r, 500))
      res = await run()
    }
    return res
  })()

  const EMPTY_CONTENT_ZONE = EMPTY_CHILD_HOME_CONTENT_ZONE

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

  const childName = (profileRow?.name ?? '').trim() || '쿠앵이'
  const childAvatarUrl =
    typeof profileRow?.avatar_url === 'string' ? profileRow.avatar_url.trim() || null : null

  /** `064` 주말 백필 시 weekly 만 쓸지 — 미션 탭과 같은 컬럼 */
  const holidayRoutineMode: 'as_weekday' | 'custom' | null = profileRow?.holiday_routine_mode ?? null

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
  /** 부모 홈과 동일하게 이 자녀의 `family_links.id` 로 캘린더를 좁힙니다(형제 일정 섞임 방지). */
  const familyLinkId = familyRows[0]?.id ?? null

  /**
   * 2단계: 캘린더·오늘 미션·콘텐츠존(레벨 8+) 병렬 조회
   * — 콘텐츠존 SSR 에서 유튜브 썸네일을 일괄 조회하지 않아 홈 TTFB 가 짧아집니다.
   */
  const contentZonePromise =
    level >= CONTENT_ZONE_UNLOCK_MIN_LEVEL
      ? fetchChildHomeContentZoneData(supabase, childId)
      : Promise.resolve(EMPTY_CONTENT_ZONE)

  const [calEvents, dailyRoutineOverride, dailyMissionsResWithSort, contentZone] = await Promise.all([
    fetchCalendarEventsForChildRoutine(missionDb, {
      today,
      childId,
      familyLinkId,
      parentId,
    }),
    fetchDailyRoutineOverride(missionDb, childId, today),
    missionDb
      .from('daily_missions')
      .select(`*, missions:mission_template_id(${missionJoinWithSort})`)
      .eq('child_id', childId)
      .eq('date', today)
      .order('scheduled_time', { ascending: true, nullsFirst: false }),
    contentZonePromise,
  ])
  const dailyMissionsRes = isMissingSortOrderColumn(dailyMissionsResWithSort.error?.message)
    ? await missionDb
        .from('daily_missions')
        .select(`*, missions:mission_template_id(${missionJoinBase})`)
        .eq('child_id', childId)
        .eq('date', today)
        .order('scheduled_time', { ascending: true, nullsFirst: false })
    : dailyMissionsResWithSort

  const routineType: MissionDayRoutineType = resolveRoutineTypeForDay(today, dailyRoutineOverride)

  if (templatesRes.error) {
    const msg = templatesRes.error.message ?? 'unknown'
    const networkHint = msg.includes('fetch failed')
      ? ' — Supabase 연결 실패(DNS/네트워크). 인터넷·VPN 확인 후 새로고침해 주세요.'
      : ''
    console.error('[child/home] missions select', msg + networkHint)
  }

  const pool = templatePoolForMissionDay(
    (templatesRes.data ?? []) as Mission[],
    childId,
    level,
    routineType,
    holidayRoutineMode,
  )

  /**
   * 오늘 행 백필 삽입:
   * - 예전: `daily_missions`가 0개일 때만 삽입 → 스페셜(이벤트/매일 스페셜) 1개라도 있으면
   *   일상 루틴이 비어도 삽입이 안 되어 “스페셜만 보이는” 날이 생길 수 있습니다.
   * - 개선: 오늘 풀(pool)에 있는 템플릿 중, 아직 오늘 `daily_missions`에 없는 것만 보충 삽입합니다.
   */
  let { data: existingRows, error: existingErr } = dailyMissionsRes
  if (existingErr) console.error('[child/home] daily_missions select', existingErr.message)

  let existing = (existingRows ?? []) as DailyMissionWithTemplate[]

  const existingTemplateIds = new Set(
    existing.filter((dm) => dm.missions != null).map((dm) => dm.mission_template_id),
  )
  const missingFromToday = pool.filter((m) => !existingTemplateIds.has(m.id))

  if (pool.length > 0 && missingFromToday.length > 0) {
    const rowsToInsert = missingFromToday.map((m) => ({
      child_id: childId,
      mission_template_id: m.id,
      date: today,
      scheduled_time: m.scheduled_time ?? null,
      routine_type: routineType,
      is_completed: false,
    }))

    /**
     * 날짜 전환 직후(특히 주말/휴일 분기)에는 누락 행이 많아질 수 있어,
     * 네트워크 왕복 N회를 1회로 줄이는 배치 업서트를 우선 사용합니다.
     */
    const bulkInsert = await missionDb.from('daily_missions').upsert(rowsToInsert, {
      onConflict: 'child_id,date,mission_template_id',
      ignoreDuplicates: true,
    })
    if (bulkInsert.error) {
      console.warn('[child/home] daily_missions bulk upsert failed, fallback to row inserts', bulkInsert.error)
      await Promise.all(
        rowsToInsert.map(async (row) => {
          const { error } = await missionDb.from('daily_missions').insert(row)
          if (error && error.code !== '23505') {
            console.error('[child/home] daily_missions insert', error)
          }
        }),
      )
    }

    const refetch = await missionDb
      .from('daily_missions')
      .select(`*, missions:mission_template_id(${missionJoinWithSort})`)
      .eq('child_id', childId)
      .eq('date', today)
      .order('scheduled_time', { ascending: true, nullsFirst: false })
    const refetchResolved = isMissingSortOrderColumn(refetch.error?.message)
      ? await missionDb
          .from('daily_missions')
          .select(`*, missions:mission_template_id(${missionJoinBase})`)
          .eq('child_id', childId)
          .eq('date', today)
          .order('scheduled_time', { ascending: true, nullsFirst: false })
      : refetch
    if (refetchResolved.error)
      console.error('[child/home] daily_missions refetch', refetchResolved.error.message)
    existing = (refetchResolved.data ?? []) as DailyMissionWithTemplate[]
  }

  /**
   * 오늘의 일상 템플릿 풀에 맞지 않는 `daily_missions` 행은 카드에서 제외합니다.
   * (크론·구버전 삽입으로 평일 템플릿이 주말 행에 남은 경우 등 — DB 행은 그대로 두고 표시만 정리)
   */
  const dailyMissions = filterDailyMissionsByTemplatePool(existing, pool, routineType)

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
  /**
   * `ChildScreen` 하단 「오늘의 미션」가로 카드는 오직 여기서 만든 `dailyMissions` 로만 그려집니다.
   * (데이터가 어긋나면 `home`을 새로고침해 보세요.)
   */

  return (
    <ChildHomeScreenClient
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
      contentChannels={contentZone.channels}
      initialChestTicketQuantity={contentZone.chestTicketQuantity}
      initialActiveContentSession={contentZone.activeSession}
    />
  )
}
