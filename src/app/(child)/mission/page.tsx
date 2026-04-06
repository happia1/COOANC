/**
 * 아이 앱 미션 탭 — 서버 컴포넌트
 *
 * 오늘 daily_missions 를 조회한 뒤, 비어 있지 않아도
 * 「이 자녀 템플릿 중 오늘 넣어야 할 것」이 빠져 있으면 추가 삽입합니다.
 * (부모가 스페셜만 assign-today 로 한 줄 넣은 뒤에는 예전 로직이 전체 백필을 건너뛰어
 * 루틴·다른 스페셜이 안 보이던 문제를 막습니다.)
 */
import { createClient } from '@/lib/supabase/server'
import { getActorChildContext } from '@/lib/getActorChildContext'
import MissionTab from '@/components/child/MissionTab'
import { getSeoulDateString } from '@/lib/koreaDate'
import type { DailyMissionWithTemplate, Mission, LocalCalendarEvent } from '@/types/database'

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
      m.linked_child_id === childId &&
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
    supabase
      .from('child_stats')
      .select('credits, current_level, streak_days')
      .eq('child_id', childId)
      .maybeSingle(),
    supabase
      .from('family_links')
      .select('parent_id')
      .eq('child_id', childId)
      .limit(1)
      .maybeSingle(),
  ])

  const level = statsRes.data?.current_level ?? 0
  const credits = statsRes.data?.credits ?? 0
  const streak = statsRes.data?.streak_days ?? 0
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

  const missionJoin =
    'title, icon_emoji, description, credit_reward, heart_reward, exp_reward, reward_multiplier, difficulty, block, repeat_type'

  const { data: templates } = await supabase
    .from('missions')
    .select('*')
    .eq('is_active', true)
    .order('scheduled_time', { ascending: true, nullsFirst: false })

  const pool = templatePoolForToday((templates ?? []) as Mission[], childId, level, routineType)

  const { data: existingBefore } = await supabase
    .from('daily_missions')
    .select('mission_template_id')
    .eq('child_id', childId)
    .eq('date', today)

  const haveIds = new Set((existingBefore ?? []).map((r) => r.mission_template_id))
  const missing = pool.filter((m) => !haveIds.has(m.id))

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
      const { error } = await supabase.from('daily_missions').insert(row)
      if (error && error.code !== '23505') {
        console.error('[child/mission] daily_missions insert', error)
      }
    }
  }

  const { data: existing } = await supabase
    .from('daily_missions')
    .select(`*, missions(${missionJoin})`)
    .eq('child_id', childId)
    .eq('date', today)
    .order('scheduled_time', { ascending: true, nullsFirst: false })

  const dailyMissions = (existing ?? []) as DailyMissionWithTemplate[]

  const fullRest = routineType === 'holiday' && dailyMissions.length === 0

  return (
    <MissionTab
      childId={childId}
      dailyMissions={dailyMissions}
      credits={credits}
      streak={streak}
      today={today}
      isFullRestDay={fullRest}
    />
  )
}
