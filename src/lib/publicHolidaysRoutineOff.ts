/**
 * 루틴 도우미: 법정 공휴일 자동 보정 기능은 현재 비활성화 상태입니다.
 * 비개발자: 입력한 일정 유형/루틴 설정을 시스템이 공휴일이라고 자동 변경하지 않습니다.
 */

import type { AgentParseEvent, AgentParseResponse, AgentParsedScheduleRow } from '@/lib/agentApi'

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

/**
 * 과거 호환을 위해 함수 시그니처는 유지하되, 응답은 그대로 돌려줍니다.
 */
export async function enrichAgentParseResponseWithHolidayRoutineOff(
  res: AgentParseResponse,
): Promise<AgentParseResponse> {
  return res
}
