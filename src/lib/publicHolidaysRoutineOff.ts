/**
 * 루틴 도우미: 일정이 **법정 공휴일(is_holiday=Y)** 과 겹치면 `routine_off: true` 를 붙입니다.
 * 비개발자: "쉬는 날이면 미션도 쉬게 할까요?" 토글이 자동으로 켜지게 하는 규칙입니다.
 */

import type { AgentParseEvent, AgentParseResponse } from '@/lib/agentApi'
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

function applyHolidayToEvent(ev: AgentParseEvent, holidaySet: Set<string>): AgentParseEvent {
  const hit = expandYmdInclusive(ev.start_date, ev.end_date).some((d) => holidaySet.has(d))
  if (!hit) return ev
  return { ...ev, routine_off: true }
}

/**
 * `public_holidays` 테이블을 조회해, 일정 기간과 겹치는 공휴일(Y)이 있으면 `routine_off` 를 true 로 설정합니다.
 * Supabase 미설정·테이블 없음 등은 조용히 원본을 돌려줍니다.
 */
export async function enrichAgentParseResponseWithHolidayRoutineOff(
  res: AgentParseResponse,
): Promise<AgentParseResponse> {
  const dates = collectDatesFromResponse(res)
  if (dates.length === 0) return res

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('public_holidays')
      .select('holiday_date')
      .in('holiday_date', dates)
      .eq('is_holiday', 'Y')
    if (error || !data?.length) return res

    const holidaySet = new Set(data.map((r) => String((r as { holiday_date: string }).holiday_date).slice(0, 10)))

    const nextEvent = applyHolidayToEvent(res.event, holidaySet)
    const nextSchedules =
      res.schedules?.map((row) => ({
        ...row,
        event: applyHolidayToEvent(row.event, holidaySet),
      })) ?? null

    return {
      ...res,
      event: nextEvent,
      schedules: nextSchedules,
    }
  } catch {
    return res
  }
}
