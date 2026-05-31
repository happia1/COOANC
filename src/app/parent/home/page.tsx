/**
 * 부모 홈 탭 — 서버 컴포넌트
 * 전체 자녀 데이터를 한번에 조회 후 HomeTab(Client)에 전달합니다.
 * (구매 승인 대기 건수는 공통 레이아웃에서만 조회해 상단 알람 시트로 넘깁니다.)
 *
 * 「오늘 미션 달성률」은 자녀 앱「오늘의 미션」과 같이,
 * **그날짜(date)로 배정된 daily_missions 행 전부**를 분모로 씁니다.
 * (오전·오후·스페셜 등 당일 생성·배정된 카드가 빠지지 않도록 블록별 필터는 두지 않습니다.)
 *
 * 「일정 브리핑」용으로 오늘~오늘+6일 구간의 `calendar_events`와 동일 구간 `public_holidays` 를 함께 불러 `HomeTab` 에 넘깁니다(캘린더 빨간 공휴일과 동일 테이블).
 */

export const preferredRegion = 'hnd1'


import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCachedParentAuth } from '@/lib/parentServerAuthCache'
import { resolveDisplayAge } from '@/lib/ageFromBirthDate'
import {
  profileAgeGroupShortLabel,
  profileInstitutionLabel,
  resolveProfileAgeGroup,
} from '@/lib/childProfileDisplay'
import { selectChildProfilesByIds } from '@/lib/supabase/childProfileSelect'
import {
  addSeoulCalendarDays,
  getSeoulDateString,
  getSeoulMondayOfWeekContaining,
} from '@/lib/koreaDate'
import { buildWeeklyRoutineDays, type DailyMissionCompletionRow } from '@/lib/childWeeklyRoutine'
import HomeTab, { type ChildSummary } from '@/components/parent/HomeTab'
import { unstable_cache } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/admin'

/** ISO 시각으로부터 경과 일수를 계산해 에이전트 재실행 주기를 판단합니다. */
function daysSince(isoString: string): number {
  return Math.floor((Date.now() - new Date(isoString).getTime()) / 86400000)
}

/**
 * 자녀 프로필은 빈번히 바뀌지 않으므로 5분 캐시를 둡니다.
 * - service_role 이 있으면 RLS와 무관하게 빠르게 읽고,
 * - 없으면 호출부에서 기존 세션 클라이언트 조회로 폴백합니다.
 */
const getCachedChildProfilesForParentHome = unstable_cache(
  async (childIdsKey: string) => {
    const childIds = childIdsKey.split(',').filter(Boolean)
    if (childIds.length === 0) return { rows: [], error: null as { message: string } | null }
    const svc = createServiceRoleClient()
    if (!svc) return { rows: null, error: { message: 'no_service_role' } }
    return selectChildProfilesByIds(svc, childIds)
  },
  ['parent-home-child-profiles'],
  {
    revalidate: 300,
    /**
     * 자녀 프로필 저장 API(/api/child/update-profile)에서 `revalidateTag`로 즉시 무효화합니다.
     * 덕분에 "자녀 앱 -> 부모 앱"으로 돌아왔을 때 오래된 프로필 카드가 남지 않습니다.
     */
    tags: ['parent-home-child-profiles'],
  },
)

/**
 * 부모 홈의 주간 `daily_missions` 조회를 60초 캐시합니다.
 * 세션 검증은 요청마다 유지하고, 무거운 집계 원본 데이터만 재사용해 DB IO를 줄입니다.
 */
const getCachedDailyMissionsForParentHome = unstable_cache(
  async (childIdsKey: string, weekStart: string, weekEnd: string) => {
    const childIds = childIdsKey.split(',').filter(Boolean)
    if (childIds.length === 0) return [] as { child_id: string; date: string; is_completed: boolean }[]
    const svc = createServiceRoleClient()
    if (!svc) return [] as { child_id: string; date: string; is_completed: boolean }[]
    const { data, error } = await svc
      .from('daily_missions')
      .select('child_id, date, is_completed')
      .in('child_id', childIds)
      .gte('date', weekStart)
      .lte('date', weekEnd)
    if (error) {
      console.error('[parent home] cached daily_missions:', error.message)
      return [] as { child_id: string; date: string; is_completed: boolean }[]
    }
    return (data ?? []) as { child_id: string; date: string; is_completed: boolean }[]
  },
  ['parent-home-daily-missions'],
  {
    revalidate: 60,
    tags: ['parent-home-daily-missions'],
  },
)

export default async function ParentHomePage() {
  const auth = await getCachedParentAuth()
  if (!auth?.user) redirect('/login')
  if (!auth.profile || auth.profile.role !== 'parent') redirect('/home')

  const supabase = await createClient()
  const childIds = auth.familyLinks.map((l) => l.child_id)
  const familyLinkIds = auth.familyLinks.map((l) => l.id)
  const familyLinkByChild: Record<string, string> = Object.fromEntries(auth.familyLinks.map((l) => [l.child_id, l.id]))
  const childIdByFamilyLink: Record<string, string> = Object.fromEntries(auth.familyLinks.map((l) => [l.id, l.child_id]))

  if (childIds.length === 0) {
    return <HomeTab childrenData={[]} upcomingEvents={[]} daysWithDataByChild={{}} familyLinkByChild={{}} />
  }

  const today = getSeoulDateString()
  /** 일정 브리핑·캘린더 카드와 맞춤: 서울 기준 「오늘」부터 **6일 뒤**까지(포함하면 7일치) 겹치는 일정만 사용 */
  const briefingEndInclusive = addSeoulCalendarDays(today, 6)
  const weekStart = getSeoulMondayOfWeekContaining(today)
  const weekEnd = addSeoulCalendarDays(weekStart, 6)
  const primaryChildId = childIds[0]

  const childIdsKey = [...childIds].sort().join(',')
  const [
    cachedProfilesRes,
    statsRes,
    weekDailyRows,
    recentLogsRes,
    calendarEventsRes,
    /** 루틴 캘린더의 빨간 법정공휴일과 같은 출처(`public_holidays`)를 브리핑에도 포함합니다 */
    publicHolidaysBriefingRes,
    agentReportsRes,
  ] = await Promise.all([
    getCachedChildProfilesForParentHome(childIdsKey),
    supabase
      .from('child_stats')
      .select('child_id, credits, credits_wallet, credits_piggy, hearts, current_level, exp, exp_to_next_level, streak_days, eq_delay_score, eq_routine_rate, eq_save_ratio')
      .in('child_id', childIds),

    // 경제 EQ 카드 + AI 준비도에 공용으로 쓰는 주간 배정 미션 원본(60초 캐시)
    getCachedDailyMissionsForParentHome(childIdsKey, weekStart, weekEnd),

    supabase
      .from('mission_logs')
      .select('child_id, completed_at, credit_earned, missions(title, icon_emoji)')
      .in('child_id', childIds)
      .eq('is_completed', true)
      .order('completed_at', { ascending: false })
      .limit(30),

    // 홈 상단 일정 브리핑 — 오늘~오늘+6일 구간과 겹치는 캘린더 일정(자녀 필터링은 클라이언트)
    supabase
      .from('calendar_events')
      .select('id, start_date, end_date, routine_override, title, event_type, family_link_id')
      .in('family_link_id', familyLinkIds)
      .or(`end_date.gte.${today},end_date.is.null`)
      .lte('start_date', briefingEndInclusive)
      .order('start_date', { ascending: true })
      .limit(50),

    /** 동일 브리핑 구간의 법정 공휴일(노동절·어린이날 등) — 캘린더 칸 이름과 같은 DB */
    supabase
      .from('public_holidays')
      .select('date, name')
      .gte('date', today)
      .lte('date', briefingEndInclusive)
      .order('date', { ascending: true }),

    // 최신 리포트 1건 조회: 자동 실행 필요 여부 판단용
    supabase
      .from('agent_reports')
      .select('created_at')
      .eq('child_id', primaryChildId)
      .order('created_at', { ascending: false })
      .limit(1),
  ])
  const profileRes =
    cachedProfilesRes.rows !== null
      ? cachedProfilesRes
      : await selectChildProfilesByIds(supabase, childIds)
  if (profileRes.error) {
    console.error('[parent home] profiles:', profileRes.error.message)
  }
  const profiles = profileRes.rows ?? []
  const statsMap = Object.fromEntries(
    ((statsRes.data ?? []) as { child_id: string; [key: string]: unknown }[]).map((s) => [s.child_id, s])
  )

  // 자녀별: 오늘/이번주 daily_missions 집계(쿼리 1회 결과를 재사용)
  const todayProgressMap: Record<string, { total: number; completed: number }> = {}
  for (const cid of childIds) todayProgressMap[cid] = { total: 0, completed: 0 }

  // 자녀별 이번 주 daily_missions → 월~일 막대 데이터
  const weekRowsByChild: Record<string, DailyMissionCompletionRow[]> = {}
  for (const cid of childIds) weekRowsByChild[cid] = []
  for (const row of weekDailyRows as { child_id: string; date: string; is_completed: boolean }[]) {
    const bucket = weekRowsByChild[row.child_id]
    if (!bucket) continue
    bucket.push({ date: row.date, is_completed: row.is_completed })
    if (row.date === today) {
      const acc = todayProgressMap[row.child_id]
      if (acc) {
        acc.total += 1
        if (row.is_completed) acc.completed += 1
      }
    }
  }

  // 최근 활동: child_id별 분류 (최대 5개)
  type RawLog = { child_id: string; completed_at: string | null; credit_earned: number; missions: { title: string; icon_emoji: string } | null }
  const recentMap: Record<string, RawLog[]> = {}
  for (const log of (recentLogsRes.data ?? []) as unknown as RawLog[]) {
    if (!recentMap[log.child_id]) recentMap[log.child_id] = []
    if (recentMap[log.child_id].length < 5) recentMap[log.child_id].push(log)
  }

  // ChildSummary 조합
  const childrenData: ChildSummary[] = profiles.map((p) => {
    const stats = statsMap[p.id] as unknown as ChildSummary['stats'] | undefined
    const prog = todayProgressMap[p.id] ?? { total: 0, completed: 0 }

    const displayAge = resolveDisplayAge(p.birth_date ?? null, p.age)
    const ag = resolveProfileAgeGroup(p.age_group, displayAge)

    return {
      id: p.id,
      name: p.name,
      age: displayAge,
      ageGroupLabel: profileAgeGroupShortLabel(ag),
      childcareLabel: profileInstitutionLabel(ag, p.institution_type),
      avatarUrl: p.avatar_url ?? null,
      stats: stats ?? null,
      weeklyRoutine: buildWeeklyRoutineDays(today, weekRowsByChild[p.id] ?? []),
      todayCompleted: prog.completed,
      totalMissions: prog.total,
      recentActivity: (recentMap[p.id] ?? []).map((log) => ({
        missionTitle: log.missions?.title ?? '미션',
        missionEmoji: log.missions?.icon_emoji ?? '⭐',
        completedAt: log.completed_at ?? '',
        creditEarned: log.credit_earned,
      })),
    }
  })

  type BriefingEv = {
    id: string
    start_date: string
    end_date: string | null
    routine_override?: string | null
    event_type?: string | null
    title?: string | null
    child_id?: string | null
  }

  const phBriefingRows: BriefingEv[] = (publicHolidaysBriefingRes.data ?? []).map((raw) => {
    const d = String((raw as { date: string }).date).slice(0, 10)
    const name = String((raw as { name: string }).name ?? '').trim()
    return {
      id: `__public_holiday__:${d}`,
      start_date: d,
      end_date: d,
      routine_override: 'none',
      event_type: 'holiday',
      title: name || '공휴일',
      child_id: null,
    }
  })

  const calendarBriefingRows: BriefingEv[] = (calendarEventsRes.data ?? []).map((raw) => {
    const row = raw as {
      id: string
      start_date: string
      end_date: string | null
      routine_override?: string | null
      event_type?: string | null
      title?: string | null
      family_link_id?: string
    }
    return {
      id: row.id,
      start_date: row.start_date,
      end_date: row.end_date,
      routine_override: row.routine_override,
      event_type: row.event_type,
      title: row.title,
      child_id: row.family_link_id ? childIdByFamilyLink[row.family_link_id] ?? null : null,
    }
  })

  /** 공휴일부터 합치고 시작일 순으로 정렬 — 클라에서 다시 한 번 브리핑 구간 필터링합니다 */
  const upcomingEvents: BriefingEv[] = [...phBriefingRows, ...calendarBriefingRows].sort((a, b) =>
    a.start_date.localeCompare(b.start_date),
  )

  const daysWithDataByChild: Record<string, number> = {}
  for (const cid of childIds) daysWithDataByChild[cid] = 0
  const daysSetByChild: Record<string, Set<string>> = {}
  for (const cid of childIds) daysSetByChild[cid] = new Set<string>()
  for (const row of weekDailyRows as { child_id: string; date: string | null }[]) {
    if (!row.child_id) continue
    const day =
      typeof row.date === 'string'
        ? row.date.slice(0, 10)
        : row.date
          ? String(row.date)
          : ''
    if (!day) continue
    if (!daysSetByChild[row.child_id]) daysSetByChild[row.child_id] = new Set<string>()
    daysSetByChild[row.child_id].add(day)
  }
  for (const cid of childIds) {
    daysWithDataByChild[cid] = daysSetByChild[cid]?.size ?? 0
  }
  const daysWithData = daysWithDataByChild[primaryChildId] ?? 0

  const lastReport = (agentReportsRes.data ?? [])[0]
  const agentBaseUrl = process.env.AGENT_BASE_URL

  /**
   * 서버 사이드 트리거: 리포트가 아예 없는 경우(최초 접속)에만 에이전트를 깨웁니다.
   * - 7일 이상 된 리포트의 갱신은 클라이언트 훅(useParentAgentReport)이 LLM_COOLDOWN_MS(1시간)
   *   쿨다운과 함께 백그라운드에서 처리합니다.
   * - 서버에서 "7일 이상" 조건을 추가하면 매 접속마다 외부 에이전트가 호출되므로 제거했습니다.
   */
  // 이번 주(월~일) 7일 모두 데일리 기록이 존재할 때만 최초 분석을 실행합니다.
  const shouldRunAgent = !lastReport && daysWithData >= 7
  if (agentBaseUrl && shouldRunAgent) {
    void fetch(`${agentBaseUrl}/agent-a/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ child_id: primaryChildId, parent_id: auth.user.id }),
    }).catch((e) => console.warn('[agent-a] trigger failed', e))
  }

  return (
    <HomeTab
      childrenData={childrenData}
      upcomingEvents={upcomingEvents}
      daysWithDataByChild={daysWithDataByChild}
      familyLinkByChild={familyLinkByChild}
    />
  )
}
