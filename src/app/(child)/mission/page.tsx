/**
 * 아이 앱 미션 탭 — 서버 컴포넌트
 *
 * daily_missions 테이블에서 오늘 날짜 기준 조회.
 * 레코드가 없으면 활성 미션 템플릿을 기반으로 자동 생성(Edge Function 대체 fallback).
 * calendar_events 조회로 오늘 routine_type 결정.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MissionTab from '@/components/child/MissionTab'
import { getSeoulDateString } from '@/lib/koreaDate'
import type { DailyMissionWithTemplate, Mission, LocalCalendarEvent } from '@/types/database'

type RoutineType = 'weekday' | 'weekend' | 'holiday' | 'vacation'

function getTodayRoutineType(
  today: string,
  calendarEvents: { start_date: string; end_date: string; routine_override: string }[],
): RoutineType {
  const ev = calendarEvents.find(e => today >= e.start_date && today <= e.end_date)
  if (ev) return ev.routine_override === 'none' ? 'holiday' : 'vacation'
  const [yy, mm, dd] = today.split('-').map(Number)
  const dow = new Date(yy, mm - 1, dd).getDay()
  return dow === 0 || dow === 6 ? 'weekend' : 'weekday'
}

export default async function MissionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = getSeoulDateString()

  // ── 자녀 스탯 + 부모 ID (calendar_events 조회용)
  const [statsRes, familyRes] = await Promise.all([
    supabase
      .from('child_stats')
      .select('credits, current_level, streak_days')
      .eq('child_id', user.id)
      .maybeSingle(),
    supabase
      .from('family_links')
      .select('parent_id')
      .eq('child_id', user.id)
      .limit(1)
      .maybeSingle(),
  ])

  const level   = statsRes.data?.current_level ?? 0
  const credits = statsRes.data?.credits ?? 0
  const streak  = statsRes.data?.streak_days ?? 0
  const parentId = familyRes.data?.parent_id ?? null

  // ── 오늘 routine_type 결정
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

  const isHoliday = routineType === 'holiday'

  // ── 오늘 daily_missions 조회
  let dailyMissions: DailyMissionWithTemplate[] = []

  const { data: existing } = await supabase
    .from('daily_missions')
    .select('*, missions(title, icon_emoji, description, credit_reward, heart_reward, exp_reward, difficulty, block)')
    .eq('child_id', user.id)
    .eq('date', today)
    .order('scheduled_time', { ascending: true, nullsFirst: false })

  if (existing && existing.length > 0) {
    dailyMissions = existing as DailyMissionWithTemplate[]
  } else if (!isHoliday) {
    // ── Fallback: 활성 미션 템플릿으로 daily_missions 자동 생성
    const { data: templates } = await supabase
      .from('missions')
      .select('*')
      .eq('is_active', true)
      .order('scheduled_time', { ascending: true, nullsFirst: false })

    // 공용(null) + 이 아이에게만 묶인 템플릿만 오늘 일정에 넣음
    const filtered = ((templates ?? []) as Mission[]).filter(
      (m) =>
        m.level_required <= level && (m.linked_child_id == null || m.linked_child_id === user.id),
    )

    if (filtered.length > 0) {
      const inserts = filtered.map(m => ({
        child_id:            user.id,
        mission_template_id: m.id,
        date:                today,
        scheduled_time:      m.scheduled_time ?? null,
        routine_type:        routineType,
        is_completed:        false,
      }))

      const { data: created } = await supabase
        .from('daily_missions')
        .insert(inserts)
        .select('*, missions(title, icon_emoji, description, credit_reward, heart_reward, exp_reward, difficulty, block)')

      dailyMissions = (created ?? []) as DailyMissionWithTemplate[]

      // Insert 실패 시(테이블 미존재 등) 빈 배열 유지
    }
  }

  return (
    <MissionTab
      childId={user.id}
      dailyMissions={dailyMissions}
      credits={credits}
      streak={streak}
      today={today}
      isHoliday={isHoliday}
    />
  )
}
