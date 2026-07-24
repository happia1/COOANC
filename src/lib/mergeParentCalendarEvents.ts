/**
 * 부모 루틴 캘린더 — 서버(calendar_events)와 localStorage 일정을 한 목록으로 맞춥니다.
 * 비개발자: 홈 「일정 브리핑」은 DB도 보는데, 캘린더 화면은 예전에 기기 저장만 보더라서
 * 같은 일정이 한쪽에만 보이는 어긋남이 생길 수 있어, 둘을 합칩니다.
 */
import { getBrowserSessionUserId } from '@/lib/browserParentAuthCache'
import { createClient } from '@/lib/supabase/client'
import type { LocalCalendarEvent } from '@/types/database'
import {
  addDeletedCalendarEventId,
  readDeletedCalendarEventIds,
} from '@/lib/localStorageChildScope'

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

/** Supabase 행 → 캘린더 카드 모델 (`family_link_id` 로 자녀 id 를 역추적) */
export function calendarEventRowToLocal(
  row: {
    id: string
    title: string
    start_date: string
    end_date: string | null
    event_type: string | null
    routine_override: string | null
    family_link_id?: string
    child_id?: string | null
  },
  childIdByFamilyLink?: Map<string, string>,
): LocalCalendarEvent {
  const sd = String(row.start_date).slice(0, 10)
  const ed = row.end_date ? String(row.end_date).slice(0, 10) : sd
  const childId =
    row.child_id ??
    (row.family_link_id && childIdByFamilyLink?.get(row.family_link_id)) ??
    null
  return {
    id: row.id,
    childId,
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

/** 표준 UUID(v4 포함)처럼 보이면 DB 에서 온 행으로 간주 — 로컬 임시 id 와 구분 */
const UUID_LIKE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function looksLikeDbUuid(id: string): boolean {
  return UUID_LIKE_ID.test(id.trim())
}

/** 삭제 표시된 id(서버·로컬) 행 제외 */
export function filterOutDeletedCalendarEvents(events: LocalCalendarEvent[]): LocalCalendarEvent[] {
  const deleted = readDeletedCalendarEventIds()
  if (deleted.size === 0) return events
  return events.filter((e) => !deleted.has(e.id))
}

/**
 * 캘린더 일정 삭제 — localStorage 반영은 호출 쪽에서 하고,
 * DB UUID 행은 API로 서버에서도 지우며 tombstone id 를 남깁니다.
 */
export async function deleteParentCalendarEvent(eventId: string): Promise<void> {
  if (typeof window === 'undefined' || !eventId || eventId.startsWith('__public_holiday__')) return

  addDeletedCalendarEventId(eventId)

  if (!looksLikeDbUuid(eventId)) return

  try {
    await fetch('/api/calendar-event/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId }),
    })
  } catch {
    /* tombstone 으로 UI 는 유지 */
  }
}

/**
 * 캘린더 일정 서버 저장(기기 간 동기화) — 성공 시 서버 UUID 를 반환합니다.
 * childId 가 없는(가족 공통) 일정은 서버 스키마상 family_link 귀속이 안 되므로 localStorage 만 유지(null 반환).
 */
export async function createParentCalendarEvent(event: LocalCalendarEvent): Promise<string | null> {
  if (typeof window === 'undefined') return null
  if (!event.childId) return null
  try {
    const res = await fetch('/api/calendar-event/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        childId: event.childId,
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
        eventType: event.eventType,
        routineOverride: event.routineOverride,
      }),
    })
    if (!res.ok) return null
    const json = (await res.json().catch(() => ({}))) as { id?: string }
    return typeof json.id === 'string' ? json.id : null
  } catch {
    return null
  }
}

/**
 * 캘린더 일정 편집 서버 반영(기기 간 동기화) — DB UUID 행만 서버 업데이트합니다.
 * 로컬 전용(임시 id) 일정은 서버에 없으므로 localStorage 만 유지(호출 측에서 처리).
 */
export async function updateParentCalendarEvent(event: LocalCalendarEvent): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!looksLikeDbUuid(event.id)) return false
  try {
    const res = await fetch('/api/calendar-event/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: event.id,
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
        eventType: event.eventType,
        routineOverride: event.routineOverride,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * 같은 제목·시작일(localStorage 중복 삽입 등)이 여러 줄일 때 한 줄로 줄입니다.
 * - 둘 중 id 가 DB UUID 형태면 그쪽을 우선
 * - 둘 다 UUID 거나 둘 다 아니면 **나중에 나온 항목**을 유지(최근 저장 우선)
 */
export function dedupeMergedCalendarEventsByTitleAndStart(events: LocalCalendarEvent[]): LocalCalendarEvent[] {
  const keyOrder: string[] = []
  const byKey = new Map<string, LocalCalendarEvent>()

  for (const e of events) {
    const k = `${e.title.trim().toLowerCase()}\u0000${String(e.startDate).slice(0, 10)}`
    if (!byKey.has(k)) keyOrder.push(k)

    const prev = byKey.get(k)
    if (!prev) {
      byKey.set(k, e)
      continue
    }
    const pDb = looksLikeDbUuid(prev.id)
    const cDb = looksLikeDbUuid(e.id)
    if (cDb && !pDb) byKey.set(k, e)
    else if (pDb && !cDb) {
      /* 이전 행 유지 */
    } else {
      byKey.set(k, e)
    }
  }

  return keyOrder.map((k) => byKey.get(k)!)
}

type CalRow = {
  id: string
  title: string
  start_date: string
  end_date: string | null
  event_type: string | null
  routine_override: string | null
  family_link_id: string
}

/**
 * 로그인한 부모 기준으로 `calendar_events` 를 읽어 옵니다.
 *
 * 스키마: `calendar_events.family_link_id` → `family_links.id` (RLS 가 family_links 로 부모 확인).
 * `parent_id` 컬럼은 없으므로 `.eq('parent_id', …)` 같은 조회는 쓰지 않습니다.
 *
 * 흐름: 현재 부모 uid 로 `family_links.id` 목록을 구한 뒤 `calendar_events` 를 `family_link_id IN (…)` 로만 조회합니다.
 * 자녀 필터가 필요하면(`childId` 지정) 해당 자녀의 `family_link_id` 행만 조회합니다.
 */
export async function fetchParentCalendarEventsFromServer(childId: string | null): Promise<LocalCalendarEvent[]> {
  const supabase = createClient()
  /** 서버 `/user` 대신 로컬 세션 — Auth storage 락 경쟁을 줄입니다 */
  const userId = await getBrowserSessionUserId(supabase)
  if (!userId) return []

  let linksQuery = supabase.from('family_links').select('id, child_id').eq('parent_id', userId)
  if (childId) {
    linksQuery = linksQuery.eq('child_id', childId)
  }
  const { data: allLinks } = await linksQuery
  const familyLinkIds = (allLinks ?? []).map((r) => r.id).filter(Boolean)
  if (familyLinkIds.length === 0) return []

  const res = await supabase
    .from('calendar_events')
    .select('id, title, start_date, end_date, event_type, routine_override, family_link_id')
    .in('family_link_id', familyLinkIds)
  if (res.error || !res.data) return []

  const childIdByFamilyLink = new Map<string, string>(
    (allLinks ?? []).map((row: { id: string; child_id: string }) => [row.id, row.child_id] as const),
  )
  return (res.data as CalRow[]).map((row) => calendarEventRowToLocal(row, childIdByFamilyLink))
}
