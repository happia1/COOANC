/**
 * 「오늘」 루틴 모드별로 자녀 화면에 노출할 **일상** 미션 템플릿 풀 계산 (순수 함수)
 *
 * 비개발자 요약:
 * - 평일 → “매일(daily)”로 저장된 루틴만 후보입니다.
 * - 주말·휴가 느낌의 날 → 보통은 “주간(weekly)” 루틴을 쓰고, 없으면 평일과 같은 daily 로 돌아갑니다.
 * - 부모가 「휴일만 따로」를 선택한 경우(custom)에는 주말에 weekly 만 씁니다(비어 있으면 일상 카드가 안 나올 수 있음).
 * - 캘린더에서 그날이 「루틴 없음」이면 풀 자체가 비어 → 일상 미션 없음(스페셜은 별도).
 */
import { isSpecialSectionMission } from '@/lib/specialMissionChips'
import { uuidStringsEqual } from '@/lib/normalizeUuid'
import type { DailyMissionWithTemplate, Mission } from '@/types/database'

export type MissionDayRoutineType = 'weekday' | 'weekend' | 'holiday' | 'vacation'

/**
 * @param templates — DB `missions` 전부 또는 이 자녀 관련 부분
 * @param childId — 이 자녀 UUID (linked_child_id 와 정확히 일치하는 템플릿만 사용)
 * @param level — 잠긴 미션 제외용
 * @param routineType — 캘린더 + 요일로 정해진 오늘 모드
 * @param holidayRoutineMode — profiles.holiday_routine_mode (주말을 weekly 만 쓸지 등)
 */
export function templatePoolForMissionDay(
  templates: Mission[],
  childId: string,
  level: number,
  routineType: MissionDayRoutineType,
  holidayRoutineMode: 'as_weekday' | 'custom' | null,
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

  if (routineType === 'weekend' && holidayRoutineMode === 'custom') {
    return dailyOrWeekly.filter((m) => m.repeat_type === 'weekly')
  }

  const weekly = dailyOrWeekly.filter((m) => m.repeat_type === 'weekly')
  return weekly.length > 0 ? weekly : dailyOrWeekly.filter((m) => m.repeat_type === 'daily')
}

/**
 * `daily_missions` 조회 결과를 오늘의 일상 풀에 맞게 걸러 자녀 카드에 넘깁니다.
 * - 스페셜(이벤트·매일 스페셜)은 루틴 모드와 무관하게 유지합니다.
 * - 그 외(일상)은 `mission_template_id` 가 오늘 풀에 있을 때만 남깁니다.
 * - 다만 휴식(`holiday`)이 아닌데 필터 후 일상이 한 장도 안 남으면, 루틴 수정 직후의 불일치로 보고
 *   배정된 일상 행을 그대로 보여 줍니다(빈 슬라이더 방지).
 *
 * 비개발자: DB에 예전에 잘못 들어간 “오늘 아닌 루틴” 행을 숨기려는 기능인데,
 *          고친 직후 하루 동안은 안 맞을 수 있어 그때는 일단 카드를 보여 줍니다.
 */
function countRoutineMissions(rows: DailyMissionWithTemplate[]): number {
  return rows.filter((dm) => dm.missions && !isSpecialSectionMission(dm.missions)).length
}

/**
 * @param routineType — `holiday`(루틴 끔)일 때는 폴백을 쓰지 않고, 풀 기준으로 일상을 숨깁니다.
 */
export function filterDailyMissionsByTemplatePool(
  rows: DailyMissionWithTemplate[],
  pool: Mission[],
  routineType: MissionDayRoutineType,
): DailyMissionWithTemplate[] {
  const poolIds = new Set(pool.map((m) => m.id))
  const filtered = rows.filter((dm) => {
    const tmpl = dm.missions
    if (!tmpl) return false
    if (isSpecialSectionMission(tmpl)) return true
    return poolIds.has(dm.mission_template_id)
  })

  /**
   * 부모가 루틴·순서·연결 자녀 등을 고친 직후 `pool` 과 오늘 이미 만들어진 `daily_missions` 가 잠깐 어긋나면
   * 일상 카드가 **전부** 사라질 수 있습니다. 휴식 날이 아니고 DB 에 일상 행이 있는데 필터가 한 장도 못 남기면,
   * 배정된 행을 그대로 보여 주어 빈 화면을 막습니다(스페셜·조인 없는 행은 여전히 제외).
   */
  if (routineType !== 'holiday') {
    const beforeR = countRoutineMissions(rows)
    const afterR = countRoutineMissions(filtered)
    if (beforeR > 0 && afterR === 0) {
      return rows.filter((dm) => dm.missions != null)
    }
  }

  return filtered
}
