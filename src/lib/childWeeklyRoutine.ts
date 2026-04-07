/**
 * 부모 홈 「일일 루틴 완주율」 막대 그래프용 데이터를 만듭니다.
 *
 * - 서울 달력 기준 **이번 주 월요일~일요일**(오늘이 속한 주) 각 날에 배정된 `daily_missions` 전체를 분모로 합니다.
 *   (「오늘 미션 달성률」과 같이 당일 배정 카드가 모두 포함됩니다.)
 * - 아직 오지 않은 날·미션 없는 날은 0%이고 `hasMissions: false` 로 두어 막대만 비우면 됩니다.
 */
import {
  addSeoulCalendarDays,
  getSeoulMondayOfWeekContaining,
  getSeoulWeekdayShort,
} from '@/lib/koreaDate'

/** YYYY-MM-DD → 차트 아래에 붙이는 짧은 날짜 (예: 10.21) */
function formatSeoulMonthDayDot(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!m) return ''
  const month = String(Number(m[2]))
  const day = String(Number(m[3])).padStart(2, '0')
  return `${month}.${day}`
}

/** 하루 집계 결과(차트 한 칸) */
export type WeeklyRoutineDay = {
  /** YYYY-MM-DD (서울) */
  date: string
  /** 짧은 요일 라벨: 월, 화, … */
  weekdayShort: string
  /** 막대 아래 작은 글씨용 (예: 10.21) */
  dateLabelShort: string
  /** 0~100, 미션 없으면 0 */
  ratePercent: number
  /** 그날 배정된 미션이 1개라도 있었는지 */
  hasMissions: boolean
}

export type DailyMissionCompletionRow = {
  date: string
  is_completed: boolean
}

/**
 * 오늘(서울)이 속한 주의 월요일~일요일 7칸 완주율을 **월→일 순**으로 돌려줍니다.
 */
export function buildWeeklyRoutineDays(
  todaySeoul: string,
  rows: DailyMissionCompletionRow[],
): WeeklyRoutineDay[] {
  const byDate: Record<string, { total: number; done: number }> = {}

  for (const r of rows) {
    if (!byDate[r.date]) byDate[r.date] = { total: 0, done: 0 }
    byDate[r.date].total += 1
    if (r.is_completed) byDate[r.date].done += 1
  }

  const monday = getSeoulMondayOfWeekContaining(todaySeoul)
  const out: WeeklyRoutineDay[] = []
  for (let delta = 0; delta <= 6; delta += 1) {
    const date = addSeoulCalendarDays(monday, delta)
    const agg = byDate[date] ?? { total: 0, done: 0 }
    const hasMissions = agg.total > 0
    const ratePercent = hasMissions ? Math.round((agg.done / agg.total) * 100) : 0

    out.push({
      date,
      weekdayShort: getSeoulWeekdayShort(date),
      dateLabelShort: formatSeoulMonthDayDot(date),
      ratePercent,
      hasMissions,
    })
  }

  return out
}
