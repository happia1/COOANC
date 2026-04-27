/**
 * 아이 앱 미션 탭 — 서버 컴포넌트
 *
 * ※ `/api/parent/enter-child-ui` 는 여기서 호출하지 않습니다.
 *   부모 미리보기 세션은 `PARENT_AS_CHILD_COOKIE`(HttpOnly) + `getActorChildContext` 만 사용합니다.
 *
 * 오늘 `daily_missions` 를 조인과 함께 한 번 읽고, 행이 없을 때만 템플릿 풀을 백필합니다.
 * (이미 오늘 행이 있으면 백필을 건너뛰어 대부분의 요청에서 insert·refetch 가 없습니다.)
 *
 * 템플릿 조회·daily_missions 쓰기/읽기는 가능하면 service_role 로 통일합니다.
 * - 자녀 세션 RLS·조인(embed) 환경 차이로 목록이 비는 경우를 줄입니다.
 * - actorChildId 는 getActorChildContext 가 이미 검증했습니다.
 */
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { getCachedProfileRowById, getCachedFamilyLinksForChild } from '@/lib/childAppDataCache'
import { getActorChildContext } from '@/lib/getActorChildContext'
import { getMissionTemplatesForChildMissionPage } from '@/lib/missionsTemplateCache'
import MissionTab from '@/components/child/MissionTab'
import { getSeoulDateString } from '@/lib/koreaDate'
import { uuidStringsEqual } from '@/lib/normalizeUuid'
import type {
  ChildStats,
  DailyMissionWithTemplate,
  Mission,
  PraiseStickerGrant,
  PraiseStickerPlacement,
} from '@/types/database'

/**
 * 미션 페이지는 로그인 쿠키·Supabase 환경변수에 의존하므로
 * 빌드 시 정적 사전 렌더링(prerender)을 하지 않고 요청 시점에 렌더링합니다.
 */
export const dynamic = 'force-dynamic'
/** 요청마다 최신 데이터를 다시 계산해 자정 직후 stale 페이지를 피합니다. */
export const revalidate = 0
export const preferredRegion = 'hnd1'

type RoutineType = 'weekday' | 'weekend' | 'holiday' | 'vacation'

function getTodayRoutineType(
  today: string,
  calendarEvents: { start_date: string; end_date: string; routine_override: string }[],
): RoutineType {
  const ev = calendarEvents.find((e) => today >= e.start_date && today <= e.end_date)
  if (ev) return ev.routine_override === 'none' ? 'holiday' : 'vacation'
  const [yy, mm, dd] = today.split('-').map(Number)
  const dow = new Date(yy, mm - 1, dd).getDay()
  return dow === 0 || dow === 6 ? 'weekend' : 'weekday'
}

/**
 * 오늘 routine_type 에 맞는 이 자녀 전용 템플릿 풀 (event 템플릿 제외 — 오늘 카드는 수동 배정만)
 *
 * - `holiday_routine_mode === 'custom'` 이고 그날이 주말( routineType === 'weekend' )이면
 *   weekly(휴일) 템플릿만 풀에 넣고, 0개여도 **daily(평일)로 폴백하지 않습니다.**
 *   (휴일 칩이 비어 있으면 `pool` 이 비어 "오늘은 미션이 없어요" 쪽으로 갑니다.)
 * - `as_weekday`·null(구 DB) 은 이전과 같이 weekly 가 없을 때 daily 로 채웁니다.
 */
function templatePoolForToday(
  templates: Mission[],
  childId: string,
  level: number,
  routineType: RoutineType,
  holidayRoutineMode: 'as_weekday' | 'custom' | null,
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

  if (routineType === 'weekend' && holidayRoutineMode === 'custom') {
    return dailyOrWeekly.filter((m) => m.repeat_type === 'weekly')
  }

  const weekly = dailyOrWeekly.filter((m) => m.repeat_type === 'weekly')
  return weekly.length > 0 ? weekly : dailyOrWeekly.filter((m) => m.repeat_type === 'daily')
}

type CalEventRow = { start_date: string; end_date: string; routine_override: string }

export default async function MissionPage() {
  /**
   * 컨텍스트(자녀 id)와 Supabase 클라이언트는 서로 독립 — 한 번에 기다려 TTFB 를 줄입니다.
   * 서버 컴포넌트 단계에는 팝업/모달 상태가 없어 백필을 막는 UI 블로킹 경로가 없습니다.
   */
  const [ctx, supabase] = await Promise.all([getActorChildContext(), createClient()])
  const childId = ctx.actorChildId

  const today = getSeoulDateString()

  /** embed 에 템플릿 보상·배율을 넣어 자녀 카드 숫자와 완료 API가 맞춰집니다. */
  const missionJoin =
    'title, icon_emoji, description, credit_reward, heart_reward, exp_reward, reward_multiplier, difficulty, block, repeat_type'

  /**
   * 미션 템플릿·일일행은 service_role 로 조회하면 RLS·embed 이슈 없이 부모 루틴 탭과 동일 스냅샷에 가깝습니다.
   * 키가 없으면 자녀 세션 클라이언트로 폴백합니다.
   */
  const serviceRoleClient = createServiceRoleClient()
  const missionDb = serviceRoleClient ?? supabase

  /**
   * `missions` 템플릿만 `unstable_cache`(revalidate 60초) — 탭·새로고침 때 매번 전체 스냅샷을 읽지 않습니다.
   */
  const templatesQuery =
    serviceRoleClient != null
      ? getMissionTemplatesForChildMissionPage()
      : missionDb.from('missions').select('*').order('scheduled_time', { ascending: true, nullsFirst: false })

  /**
   * 첫 번째 묶음에는 childId·부모 링크가 필요한 나머지가 들어갑니다.
   * 그 다음 단계에서 `calendar_events`(parentId 필요)와 오늘 `daily_missions` 를 병렬로 둡니다.
   */
  const [statsRes, profileRow, familyRows, grantsRes, placementsRes, templatesRes] = await Promise.all([
    supabase.from('child_stats').select('*').eq('child_id', childId).maybeSingle(),
    getCachedProfileRowById(childId),
    getCachedFamilyLinksForChild(childId),
    supabase
      .from('praise_sticker_grants')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false }),
    supabase.from('praise_sticker_placements').select('*').eq('child_id', childId),
    templatesQuery,
  ])

  const initialStats = (statsRes.data ?? null) as ChildStats | null
  const level = initialStats?.current_level ?? 0

  const childName = (profileRow?.name ?? '').trim() || '쿠앵이'
  /** `064` — 없으면 null (구 DB·미적용) → weekly 유무에 따른 기존 폴백 유지 */
  const holidayRoutineMode: 'as_weekday' | 'custom' | null = profileRow?.holiday_routine_mode ?? null
  const initialPraiseGrants = (grantsRes.data ?? []) as PraiseStickerGrant[]
  const initialPraisePlacements = (placementsRes.data ?? []) as PraiseStickerPlacement[]

  const parentId = familyRows[0]?.parent_id ?? null

  /**
   * `calendar_events` 와 오늘 `daily_missions` 는 서로 독립적이라 동시에 조회해 왕복 1회를 줄입니다.
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
  const routineType: RoutineType =
    calEvents.length > 0 ? getTodayRoutineType(today, calEvents) : getTodayRoutineType(today, [])

  if (templatesRes.error) {
    console.error('[child/mission] missions select', templatesRes.error.message)
  }

  const pool = templatePoolForToday(
    (templatesRes.data ?? []) as Mission[],
    childId,
    level,
    routineType,
    holidayRoutineMode,
  )

  /**
   * 오늘 일일 미션을 한 번 읽은 뒤, 행이 없고 휴일이 아니며 넣을 템플릿이 있을 때만 백필합니다.
   * (이전: `mission_template_id` 만 먼저 조회 → 항상 2번의 daily_missions 왕복)
   */
  let { data: existingRows, error: existingErr } = dailyMissionsRes
  if (existingErr) {
    console.error('[child/mission] daily_missions select', existingErr.message)
  }

  const existing = (existingRows ?? []) as DailyMissionWithTemplate[]
  console.log('[mission] today=', today, 'existing=', existing.length, 'pool=', pool.length)

  /**
   * 백필: 오늘 행이 0개이고, 휴일이 아니며, 넣을 템플릿 풀이 비어 있지 않을 때만 실행합니다.
   * 풀이 비어 있으면(`pool.length === 0`) insert 를 시도하지 않습니다.
   */
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
          console.error('[child/mission] daily_missions insert', error)
        }
      }),
    )
    const refetch = await missionDb
      .from('daily_missions')
      .select(`*, missions(${missionJoin})`)
      .eq('child_id', childId)
      .eq('date', today)
      .order('scheduled_time', { ascending: true, nullsFirst: false })
    if (refetch.error) {
      console.error('[child/mission] daily_missions refetch', refetch.error.message)
    }
    existingRows = refetch.data
  }

  const dailyMissions = (existingRows ?? []) as DailyMissionWithTemplate[]

  const fullRest = routineType === 'holiday' && dailyMissions.length === 0

  return (
    <MissionTab
      childId={childId}
      childName={childName}
      initialStats={initialStats}
      initialPraiseGrants={initialPraiseGrants}
      initialPraisePlacements={initialPraisePlacements}
      dailyMissions={dailyMissions}
      today={today}
      isFullRestDay={fullRest}
    />
  )
}
