/**
 * 루틴 도우미: 일정이 **법정 공휴일(`public_holidays.date`)** 과 겹치면
 * - `type: 'holiday'`, `routine_off: true` 로 맞추고
 * - 응답에 `holiday_auto_applied` / 슬롯별 `holiday_auto_from_public` 플래그를 붙입니다.
 * 비개발자: "그날은 법정 쉬는 날이니까 휴일로 처리할게요" 라고 앱이 스스로 정해 주는 단계입니다.
 */

import type { AgentParseEvent, AgentParseResponse, AgentParsedScheduleRow } from '@/lib/agentApi'
import { createClient } from '@/lib/supabase/client'

/** YYYY-MM-DD 문자열 두 개 사이(포함)의 모든 날짜 */
export function expandYmdInclusive(startYmd: string, endYmd: string | null | undefined): string[] {
  const start = startYmd.trim()
  const end = (endYmd && endYmd.trim()) || start
  const m1 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start)
  const m2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(end)
  if (!m1 || !m2) return [start]
  const d0 = new Date(Number(m1[1]), Number(m1[2]) - 1, Number(m1[3]))
  const d1 = new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]))
  if (Number.isNaN(d0.getTime()) || Number.isNaN(d1.getTime()) || d0 > d1) return [start]
  const out: string[] = []
  const cur = new Date(d0)
  while (cur <= d1) {
    const y = cur.getFullYear()
    const mo = String(cur.getMonth() + 1).padStart(2, '0')
    const da = String(cur.getDate()).padStart(2, '0')
    out.push(`${y}-${mo}-${da}`)
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

function collectDatesFromResponse(res: AgentParseResponse): string[] {
  const set = new Set<string>()
  const addEv = (ev: AgentParseEvent) => {
    for (const d of expandYmdInclusive(ev.start_date, ev.end_date)) set.add(d)
  }
  addEv(res.event)
  for (const row of res.schedules ?? []) addEv(row.event)
  return [...set]
}

function applyPublicHolidayToEvent(
  ev: AgentParseEvent,
  holidaySet: Set<string>,
): { event: AgentParseEvent; changed: boolean } {
  const hit = expandYmdInclusive(ev.start_date, ev.end_date).some((d) => holidaySet.has(d))
  if (!hit) return { event: ev, changed: false }
  const next: AgentParseEvent = { ...ev, type: 'holiday', routine_off: true }
  /** 이미 휴일·루틴끔이면 UI 안내(배너)는 생략 */
  const changed = (ev.type || '').toLowerCase() !== 'holiday' || !ev.routine_off
  return { event: next, changed }
}

/**
 * `public_holidays` 테이블을 조회해, 일정 기간과 겹치는 행이 있으면
 * `type: holiday`, `routine_off: true` 및 UI용 플래그를 설정합니다.
 */
export async function enrichAgentParseResponseWithHolidayRoutineOff(
  res: AgentParseResponse,
): Promise<AgentParseResponse> {
  const dates = collectDatesFromResponse(res)
  if (dates.length === 0) return res

  try {
    const supabase = createClient()
    const { data, error } = await supabase.from('public_holidays').select('date').in('date', dates)
    if (error || !data?.length) return res

    const holidaySet = new Set(data.map((r) => String((r as { date: string }).date).slice(0, 10)))

    let holiday_auto_applied = false

    const r0 = applyPublicHolidayToEvent(res.event, holidaySet)
    if (r0.changed) holiday_auto_applied = true

    let nextSchedules: AgentParsedScheduleRow[] | null = res.schedules
    if (res.schedules?.length) {
      nextSchedules = res.schedules.map((row) => {
        const r = applyPublicHolidayToEvent(row.event, holidaySet)
        if (r.changed) holiday_auto_applied = true
        return {
          ...row,
          event: r.event,
          holiday_auto_from_public: r.changed ? true : row.holiday_auto_from_public,
        }
      })
    }

    return {
      ...res,
      event: r0.event,
      schedules: nextSchedules,
      holiday_auto_applied: holiday_auto_applied || undefined,
    }
  } catch {
    return res
  }
}
