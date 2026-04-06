/**
 * 자녀 홈 「요일별 루틴 완주율」 바 그래프용 데이터를 만듭니다.
 *
 * - 서울 달력 기준으로 **최근 7일**(오늘 포함) 각 날짜에 배정된 `daily_missions` 전체를 분모로 합니다.
 *   (부모 홈의 「오늘 미션 달성률」과 같은 기준: 당일 배정된 카드가 모두 포함됩니다.)
 * - 그날 미션이 하나도 없으면 막대는 0%로 두고, `hasMissions: false` 로 표시해 두면
 *   화면에서 「미션 없음」 등으로 안내할 수 있습니다.
 */
import { addSeoulCalendarDays, getSeoulWeekdayShort } from '@/lib/koreaDate'

/** 하루 집계 결과(차트 한 칸) */
export type WeeklyRoutineDay = {
  /** YYYY-MM-DD (서울) */
  date: string
  /** 짧은 요일 라벨: 월, 화, … */
  weekdayShort: string
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
 * 오늘 날짜 문자열과 `daily_missions` 행 목록을 받아,
 * 최근 7일치 완주율 배열을 **날짜 오름차순**(가장 오래된 날 → 오늘)으로 돌려줍니다.
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

  const out: WeeklyRoutineDay[] = []
  for (let delta = 6; delta >= 0; delta -= 1) {
    const date = addSeoulCalendarDays(todaySeoul, -delta)
    const agg = byDate[date] ?? { total: 0, done: 0 }
    const hasMissions = agg.total > 0
    const ratePercent = hasMissions ? Math.round((agg.done / agg.total) * 100) : 0

    out.push({
      date,
      weekdayShort: getSeoulWeekdayShort(date),
      ratePercent,
      hasMissions,
    })
  }

  return out
}
