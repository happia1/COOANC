/**
 * 브라우저 localStorage 중 「특정 자녀 id 에만 귀속」된 값을 지웁니다.
 *
 * - 캘린더 이벤트(`cooanc_calendar_events_v1`): childId 가 삭제된 자녀와 일치하는 항목만 제거합니다.
 *   childId 가 null 인 이벤트(전체 자녀 공통)는 그대로 둡니다.
 *
 * 자녀 프로필을 서버에서 지운 뒤, 클라이언트에 남은 범위(scope) 데이터를 맞추기 위한 용도입니다.
 */
/** 루틴 탭 CalendarSection 과 동일 키 — 자녀별 이벤트 범위 정리 시 사용 */
export const COOANC_CALENDAR_EVENTS_STORAGE_KEY = 'cooanc_calendar_events_v1'

const CALENDAR_EVENTS_KEY = COOANC_CALENDAR_EVENTS_STORAGE_KEY

type CalendarEventRow = {
  childId?: string | null
  [key: string]: unknown
}

export function removeLocalStorageScopedToChild(removedChildId: string): void {
  if (typeof window === 'undefined' || !removedChildId.trim()) return

  try {
    const raw = window.localStorage.getItem(CALENDAR_EVENTS_KEY)
    if (!raw) return

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return

    const next = (parsed as CalendarEventRow[]).filter(
      (ev) => ev.childId == null || ev.childId !== removedChildId,
    )

    window.localStorage.setItem(CALENDAR_EVENTS_KEY, JSON.stringify(next))
  } catch {
    /* 손상된 JSON 등은 건드리지 않음 */
  }
}
