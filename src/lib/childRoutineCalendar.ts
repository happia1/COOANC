import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 자녀 루틴(평일/주말/휴식) 판단용 — `calendar_events` 에서 날짜·루틴만 읽습니다.
 * (비개발자: 부모 캘린더에 「루틴 끔」이 오늘과 겹치면 미션 카드를 아예 안 만듭니다.)
 */
export type CalEventRow = { start_date: string; end_date: string; routine_override: string }

export type ChildRoutineCalendarType = 'weekday' | 'weekend' | 'holiday' | 'vacation'

/**
 * 오늘 날짜가 각 일정 구간 안에 들어가는 행만 고른 뒤,
 * - 겹치는 일정이 없으면 → 요일로 평일/주말
 * - 하나라도 `routine_override === 'none'` 이면 → 휴식(holiday) — 일상 미션 풀 비움
 * - 하나라도 `routine_override === 'weekday'` 이면 → 평일 루틴 강제(주말이어도)
 * - 그 외(예: `weekend`만) → vacation 브랜치로 `templatePoolForToday` 에 넘김
 */
export function resolveRoutineTypeFromCalEvents(today: string, calendarEvents: CalEventRow[]): ChildRoutineCalendarType {
  const overlapping = calendarEvents.filter((e) => today >= e.start_date && today <= e.end_date)
  if (overlapping.length === 0) {
    const [yy, mm, dd] = today.split('-').map(Number)
    const dow = new Date(yy, mm - 1, dd).getDay()
    return dow === 0 || dow === 6 ? 'weekend' : 'weekday'
  }
  if (overlapping.some((e) => e.routine_override === 'none')) return 'holiday'
  if (overlapping.some((e) => e.routine_override === 'weekday')) return 'weekday'
  return 'vacation'
}

/**
 * 부모 홈과 같이 **이 자녀의 family_link** 기준으로 서버 캘린더를 읽습니다.
 * - 신규 스키마: `family_link_id`
 * - 구 스키마 폴백: `parent_id` + (`child_id` 가 비었거나 이 자녀와 일치) — 형제 자녀 전용 일정이 섞이지 않게 함
 */
export async function fetchCalendarEventsForChildRoutine(
  missionDb: SupabaseClient,
  opts: {
    today: string
    childId: string
    familyLinkId: string | null
    parentId: string | null
  },
): Promise<CalEventRow[]> {
  const { today, childId, familyLinkId, parentId } = opts

  if (familyLinkId) {
    const res = await missionDb
      .from('calendar_events')
      .select('start_date, end_date, routine_override')
      .eq('family_link_id', familyLinkId)
      .lte('start_date', today)
      .gte('end_date', today)
      .limit(25)
    if (!res.error) return (res.data ?? []) as CalEventRow[]
    console.warn('[childRoutineCalendar] family_link_id calendar query failed, trying parent_id', res.error.message)
  }

  if (parentId) {
    const res = await missionDb
      .from('calendar_events')
      .select('start_date, end_date, routine_override')
      .eq('parent_id', parentId)
      .or(`child_id.is.null,child_id.eq.${childId}`)
      .lte('start_date', today)
      .gte('end_date', today)
      .limit(25)
    if (!res.error) return (res.data ?? []) as CalEventRow[]
    console.warn('[childRoutineCalendar] parent_id calendar query failed', res.error.message)
  }

  return []
}
