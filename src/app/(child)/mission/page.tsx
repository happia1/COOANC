/**
 * 아이 앱 미션 탭 — 서버 컴포넌트
 *
 * 오늘 daily_missions 를 조회한 뒤, 비어 있지 않아도
 * 「이 자녀 템플릿 중 오늘 넣어야 할 것」이 빠져 있으면 추가 삽입합니다.
 * (부모가 스페셜만 assign-today 로 한 줄 넣은 뒤에는 예전 로직이 전체 백필을 건너뛰어
 * 루틴·다른 스페셜이 안 보이던 문제를 막습니다.)
 *
 * 템플릿 조회·daily_missions 쓰기/읽기는 가능하면 service_role 로 통일합니다.
 * - 자녀 세션 RLS·조인(embed) 환경 차이로 목록이 비는 경우를 줄입니다.
 * - actorChildId 는 getActorChildContext 가 이미 검증했습니다.
 */
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { getActorChildContext } from '@/lib/getActorChildContext'
import MissionTab from '@/components/child/MissionTab'
import { getSeoulDateString } from '@/lib/koreaDate'
import { uuidStringsEqual } from '@/lib/normalizeUuid'
import type { ChildStats, DailyMissionWithTemplate, Mission } from '@/types/database'

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

/** 오늘 routine_type 에 맞는 이 자녀 전용 템플릿 풀 (event 템플릿 제외 — 오늘 카드는 수동 배정만) */
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

export default async function MissionPage() {
  const ctx = await getActorChildContext()
  const supabase = await createClient()
  const childId = ctx.actorChildId

  const today = getSeoulDateString()

  const [statsRes, familyRes] = await Promise.all([
    supabase.from('child_stats').select('*').eq('child_id', childId).maybeSingle(),
    supabase.from('family_links').select('parent_id').eq('child_id', childId).limit(1).maybeSingle(),
  ])

  const initialStats = (statsRes.data ?? null) as ChildStats | null
  const level = initialStats?.current_level ?? 0

  const parentId = familyRes.data?.parent_id ?? null

  let routineType: RoutineType = getTodayRoutineType(today, [])
  if (parentId) {
    const { data: calEvents } = await supabase
      .from('calendar_events')
      .select('start_date, end_date, routine_override')
      .eq('parent_id', parentId)
      .lte('start_date', today)
      .gte('end_date', today)
      .limit(5)

    if (calEvents && calEvents.length > 0) {
      routineType = getTodayRoutineType(today, calEvents)
    }
  }

  /**
   * reward_multiplier 는 028 마이그레이션 이후 컬럼 — 없는 DB 에서 embed 시 PostgREST 가 전체 조회를 실패시킵니다.
   * 생략 시 missionRewardMultiplier 가 1배로 동작합니다.
   */
  const missionJoin =
    'title, icon_emoji, description, credit_reward, heart_reward, exp_reward, difficulty, block, repeat_type'

  /**
   * 미션 템플릿·일일행은 service_role 로 조회하면 RLS·embed 이슈 없이 부모 루틴 탭과 동일 스냅샷에 가깝습니다.
   * 키가 없으면 자녀 세션 클라이언트로 폴백합니다.
   */
  const missionDb = createServiceRoleClient() ?? supabase

  const { data: templates, error: templatesErr } = await missionDb
    .from('missions')
    .select('*')
    .order('scheduled_time', { ascending: true, nullsFirst: false })

  if (templatesErr) {
    console.error('[child/mission] missions select', templatesErr.message)
  }

  const pool = templatePoolForToday((templates ?? []) as Mission[], childId, level, routineType)

  const { data: existingBefore } = await missionDb
    .from('daily_missions')
    .select('mission_template_id')
    .eq('child_id', childId)
    .eq('date', today)

  const haveIds = new Set((existingBefore ?? []).map((r) => r.mission_template_id))
  const missing = pool.filter((m) => !haveIds.has(m.id))

  let firstDailyInsertErr: { code?: string; message?: string } | null = null
  if (missing.length > 0 && routineType !== 'holiday') {
    for (const m of missing) {
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
        if (!firstDailyInsertErr) firstDailyInsertErr = { code: error.code, message: error.message }
      }
    }
  }

  const { data: existing, error: existingErr } = await missionDb
    .from('daily_missions')
    .select(`*, missions(${missionJoin})`)
    .eq('child_id', childId)
    .eq('date', today)
    .order('scheduled_time', { ascending: true, nullsFirst: false })

  if (existingErr) {
    console.error('[child/mission] daily_missions select', existingErr.message)
  }

  const dailyMissions = (existing ?? []) as DailyMissionWithTemplate[]

  const fullRest = routineType === 'holiday' && dailyMissions.length === 0

  return (
    <MissionTab
      childId={childId}
      initialStats={initialStats}
      dailyMissions={dailyMissions}
      today={today}
      isFullRestDay={fullRest}
    />
  )
}
