/**
 * 부모 루틴 캘린더 — 서버(calendar_events)와 localStorage 일정을 한 목록으로 맞춥니다.
 * 비개발자: 홈 「일정 브리핑」은 DB도 보는데, 캘린더 화면은 예전에 기기 저장만 보더라서
 * 같은 일정이 한쪽에만 보이는 어긋남이 생길 수 있어, 둘을 합칩니다.
 */
import { createClient } from '@/lib/supabase/client'
import type { LocalCalendarEvent } from '@/types/database'

/** `calendar_events.event_type` 과 동일 허용값 — DB 스키마와 맞춤 */
const EVENT_TYPES: LocalCalendarEvent['eventType'][] = [
  'holiday',
  'vacation',
  'travel',
  'birthday',
  'etc',
  'school',
  'special',
  'other',
  'event',
]

const ROUTINE_OVERRIDES: LocalCalendarEvent['routineOverride'][] = ['weekend', 'none', 'weekday']

function coerceEventType(raw: string | null | undefined): LocalCalendarEvent['eventType'] {
  const t = String(raw ?? '').toLowerCase()
  if (EVENT_TYPES.includes(t as LocalCalendarEvent['eventType'])) {
    return t as LocalCalendarEvent['eventType']
  }
  return 'other'
}

function coerceRoutineOverride(raw: string | null | undefined): LocalCalendarEvent['routineOverride'] {
  if (raw == null || String(raw).trim() === '') return 'none'
  const t = String(raw).toLowerCase()
  if (ROUTINE_OVERRIDES.includes(t as LocalCalendarEvent['routineOverride'])) {
    return t as LocalCalendarEvent['routineOverride']
  }
  return 'none'
}

/** Supabase 행 → 캘린더 카드 모델 */
export function calendarEventRowToLocal(row: {
  id: string
  title: string
  start_date: string
  end_date: string | null
  event_type: string | null
  routine_override: string | null
  child_id: string | null
}): LocalCalendarEvent {
  const sd = String(row.start_date).slice(0, 10)
  const ed = row.end_date ? String(row.end_date).slice(0, 10) : sd
  return {
    id: row.id,
    childId: row.child_id,
    title: row.title,
    startDate: sd,
    endDate: ed,
    eventType: coerceEventType(row.event_type),
    routineOverride: coerceRoutineOverride(row.routine_override),
  }
}

/**
 * 서버에서 가져온 일정 + 기기 localStorage 일정을 합칩니다.
 * - 같은 `id`면 **localStorage 쪽을 우선**(이 기기에서 방금 수정한 내용 유지)
 * - id가 서버에만 있으면 서버 행 사용
 * - id가 로컬에만 있으면 로컬 행 유지
 */
export function mergeServerAndLocalCalendar(
  server: LocalCalendarEvent[],
  local: LocalCalendarEvent[],
  selectedChildId: string | null,
): LocalCalendarEvent[] {
  const localScoped = local.filter(
    (ev) =>
      !ev.childId ||
      ev.childId === selectedChildId ||
      /** 캘린더 UI와 동일: 여행은 한 자녀 id로만 저장된 경우가 있어 병합 시에도 포함 */
      ev.eventType === 'travel',
  )
  const localById = new Map(localScoped.map((e) => [e.id, e]))
  const merged = new Map<string, LocalCalendarEvent>()

  for (const s of server) {
    const l = localById.get(s.id)
    merged.set(s.id, l ?? s)
  }
  for (const l of localScoped) {
    if (!merged.has(l.id)) merged.set(l.id, l)
  }
  return [...merged.values()]
}

type CalRow = {
  id: string
  title: string
  start_date: string
  end_date: string | null
  event_type: string | null
  routine_override: string | null
  child_id: string | null
}

/**
 * 로그인한 부모 기준으로 `calendar_events` 를 읽어 옵니다.
 *
 * **부모 홈**(`app/parent/home/page.tsx`)은 `family_link_id IN (모든 자녀 링크)` 로 일정을 가져옵니다.
 * 예전 루틴 캘린더는 **현재 탭 자녀 한 개**의 `family_link_id` 만 조회해서,
 * 제주 일정이 형제 자녀 쪽 `family_link` 에만 붙어 있으면 홈 링크는 보이는데 캘린더 병합에는 안 나오는 불일치가 났습니다.
 * → 홈과 같이 **부모에 연결된 모든 `family_links.id`** 로 한 번에 조회합니다.
 *
 * `childId` 가 null이어도(탭 미선택 등) 부모 기준 전체 링크로 조회합니다.
 *
 * - 위가 비어 있거나 오류 시 `parent_id` + `child_id` 폴백(구 스키마)
 */
export async function fetchParentCalendarEventsFromServer(childId: string | null): Promise<LocalCalendarEvent[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: allLinks } = await supabase.from('family_links').select('id').eq('parent_id', user.id)
  const familyLinkIds = (allLinks ?? []).map((r) => r.id).filter(Boolean)
  let rows: CalRow[] = []

  if (familyLinkIds.length > 0) {
    const res = await supabase
      .from('calendar_events')
      .select('id, title, start_date, end_date, event_type, routine_override, child_id')
      .in('family_link_id', familyLinkIds)
    if (!res.error && res.data) {
      rows = res.data as CalRow[]
    }
  }

  if (rows.length === 0 && childId) {
    const res2 = await supabase
      .from('calendar_events')
      .select('id, title, start_date, end_date, event_type, routine_override, child_id')
      .eq('parent_id', user.id)
      .or(`child_id.is.null,child_id.eq.${childId}`)
    if (!res2.error && res2.data) {
      rows = res2.data as CalRow[]
    }
  }

  return rows.map(calendarEventRowToLocal)
}
