/**
 * 오늘의 미션(daily_mission)이 「오후」 시간대인지 판별합니다.
 * - `missions.block` 이 afternoon / evening / bedtime 이면 오후
 * - morning 이면 오전
 * - 그 외는 `scheduled_time` 시각이 12시 이상이면 오후
 *
 * 자녀 앱 미션 카드 그림자(노랑 vs 파랑)와, 오전에 오후 미션 완료 차단 로직이 같은 기준을 씁니다.
 */
import type { DailyMissionWithTemplate } from '@/types/database'

export function isAfternoonMission(dm: DailyMissionWithTemplate): boolean {
  const block = dm.missions?.block
  if (block === 'afternoon' || block === 'evening' || block === 'bedtime') return true
  if (block === 'morning') return false
  const hhmm = dm.scheduled_time
  if (!hhmm || hhmm.length < 2) return false
  const hour = Number(hhmm.slice(0, 2))
  return Number.isFinite(hour) && hour >= 12
}
