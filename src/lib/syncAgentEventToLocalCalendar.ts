'use client'

/**
 * 루틴 도우미(에이전트)가 반환한 일정을 부모 루틴 탭 **캘린더(localStorage)** 와 맞춥니다.
 * - `CalendarSection` 은 DB 가 아니라 `COOANC_CALENDAR_EVENTS_STORAGE_KEY` 만 읽으므로,
 *   API 로 저장된 일정을 **같은 키에 append** 해야 달력에 점이 찍힙니다.
 * - 저장 후 `window` 에 커스텀 이벤트를 쏴서 같은 탭의 캘린더가 즉시 다시 읽게 합니다.
 */

import type { AgentParseEvent } from '@/lib/agentApi'
import type { LocalCalendarEvent } from '@/types/database'
import { COOANC_CALENDAR_EVENTS_STORAGE_KEY } from '@/lib/localStorageChildScope'

/** `CalendarSection` 이 `localStorage` 를 다시 읽을 때 구독하는 이벤트 이름 */
export const COOANC_CALENDAR_STORAGE_UPDATE_EVENT = 'cooanc-calendar-storage-updated'

/** 에이전트 `event.type` 문자열을 부모 캘린더(localStorage)의 `eventType` 으로 맞춥니다. */
export function agentParseTypeToLocalEventType(t: string): LocalCalendarEvent['eventType'] {
  const c = (t || '').trim().toLowerCase()
  if (c === 'holiday') return 'holiday'
  if (c === 'vacation') return 'vacation'
  if (c === 'travel') return 'travel'
  if (c === 'school') return 'event'
  if (c === 'special' || c === 'birthday') return 'special'
  return 'other'
}

/**
 * 에이전트가 HTTP 200 이더라도 **실제 추출 실패**를 `event` 안에 넣어 보내는 경우가 있습니다.
 * (예: 설명에 `추출 오류`, `503 UNAVAILABLE` JSON 이 그대로 들어감 → 캘린더에 넣으면 안 됨)
 */
export function shouldSkipSyncAgentEvent(ev: AgentParseEvent): boolean {
  const blob = `${ev.title ?? ''}\n${ev.description ?? ''}`.toLowerCase()
  if (blob.includes('추출 오류')) return true
  if (blob.includes('503') && (blob.includes('unavailable') || blob.includes('high demand'))) return true
  if (blob.includes('resource_exhausted')) return true
  if (blob.includes('"code":503') || blob.includes("'code': 503")) return true
  if (blob.includes('429') && blob.includes('too many')) return true
  return false
}

/** 서버에서 받은 일정 UUID — 공백-only 는 없음과 동일로 봅니다 */
function normalizeSavedEventId(savedEventId: string | null | undefined): string | null {
  const s = typeof savedEventId === 'string' ? savedEventId.trim() : ''
  return s.length > 0 ? s : null
}

/**
 * 에이전트 일정 한 건을 로컬 캘린더 배열 끝에 붙입니다(이미 같은 `id` 가 있으면 생략).
 * @param savedEventId 서버가 준 `saved_event_id` — **반드시 이 값을 행 id 로 사용**(있으면 임의 UUID 생성 안 함 → 서버 병합 시 중복 방지)
 */
export function syncAgentEventToLocalCalendar(
  childId: string | null,
  event: AgentParseEvent,
  savedEventId: string | null,
  opts?: { routineOverride?: LocalCalendarEvent['routineOverride'] },
): string | null {
  if (typeof window === 'undefined' || !childId) return null
  /** 추출 실패·모델 과부하 응답은 달력에 절대 반영하지 않음 */
  if (shouldSkipSyncAgentEvent(event)) return null
  const start = (event.start_date || '').trim()
  if (!start) return null
  const endRaw = (event.end_date && String(event.end_date).trim()) || ''
  const end = endRaw || start

  const stableId = normalizeSavedEventId(savedEventId)

  const row: LocalCalendarEvent = {
    id: stableId ?? crypto.randomUUID(),
    childId,
    title: (event.title || '일정').trim() || '일정',
    ...(event.description?.trim() ? { description: event.description.trim() } : {}),
    startDate: start,
    endDate: end,
    eventType: agentParseTypeToLocalEventType(event.type),
    routineOverride: opts?.routineOverride ?? 'weekend',
  }

  try {
    const raw = localStorage.getItem(COOANC_CALENDAR_EVENTS_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    const list: LocalCalendarEvent[] = Array.isArray(parsed) ? (parsed as LocalCalendarEvent[]) : []
    /** 같은 id 가 이미 있으면 삽입 생략(서버 id 또는 극히 드문 random 충돌) */
    if (list.some((e) => e && e.id === row.id)) {
      window.dispatchEvent(new Event(COOANC_CALENDAR_STORAGE_UPDATE_EVENT))
      return row.id
    }
    const next = [...list, row]
    localStorage.setItem(COOANC_CALENDAR_EVENTS_STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event(COOANC_CALENDAR_STORAGE_UPDATE_EVENT))
    return row.id
  } catch {
    /* 손상된 JSON 등은 무시 */
    return null
  }
}

/**
 * 파싱 직후 임시(random) id 로 넣었던 행을 서버 `saved_event_id` 로 바꿉니다.
 * 서버와 같은 id 행이 이미 있으면 임시 행만 제거해 merge 중복을 없앱니다.
 */
export function rewriteLocalCalendarEventIdInStorage(oldId: string, newId: string): void {
  if (typeof window === 'undefined' || !oldId || !newId || oldId === newId) return
  const nextServer = normalizeSavedEventId(newId)
  if (!nextServer) return
  try {
    const raw = localStorage.getItem(COOANC_CALENDAR_EVENTS_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(parsed)) return
    const list = parsed as LocalCalendarEvent[]
    const oldIdx = list.findIndex((e) => e && e.id === oldId)
    if (oldIdx === -1) return
    const dupIdx = list.findIndex((e) => e && e.id === nextServer)
    if (dupIdx !== -1 && dupIdx !== oldIdx) {
      list.splice(oldIdx, 1)
    } else {
      list[oldIdx] = { ...list[oldIdx], id: nextServer }
    }
    localStorage.setItem(COOANC_CALENDAR_EVENTS_STORAGE_KEY, JSON.stringify(list))
    window.dispatchEvent(new Event(COOANC_CALENDAR_STORAGE_UPDATE_EVENT))
  } catch {
    /* 손상된 JSON 등은 무시 */
  }
}

/**
 * 이미 localStorage 에 붙어 있는 일정 한 줄을 부분 수정합니다.
 * - 루틴 도우미 확인 카드에서 유형·설명·루틴 적용을 바꾼 뒤 [등록하기] 할 때 호출합니다.
 * - `eventId` 가 없거나 목록에 없으면 아무 것도 하지 않습니다.
 */
export function patchLocalCalendarEventInStorage(
  eventId: string | null | undefined,
  patch: Partial<
    Pick<LocalCalendarEvent, 'eventType' | 'description' | 'routineOverride' | 'title' | 'startDate' | 'endDate'>
  >,
): void {
  if (typeof window === 'undefined' || !eventId) return
  try {
    const raw = localStorage.getItem(COOANC_CALENDAR_EVENTS_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(parsed)) return
    const list = parsed as LocalCalendarEvent[]
    const idx = list.findIndex((e) => e && e.id === eventId)
    if (idx === -1) return
    const prevRow = list[idx]
    const nextRow: LocalCalendarEvent = { ...prevRow }
    if (patch.title != null) {
      const t = patch.title.trim()
      if (t) nextRow.title = t
    }
    if (patch.startDate != null && /^\d{4}-\d{2}-\d{2}$/.test(patch.startDate.trim())) {
      nextRow.startDate = patch.startDate.trim()
    }
    if (patch.endDate != null && /^\d{4}-\d{2}-\d{2}$/.test(patch.endDate.trim())) {
      nextRow.endDate = patch.endDate.trim()
    }
    if (patch.eventType != null) nextRow.eventType = patch.eventType
    if (patch.routineOverride != null) nextRow.routineOverride = patch.routineOverride
    if (patch.description !== undefined) {
      const trimmed = patch.description.trim()
      if (trimmed) nextRow.description = trimmed
      else delete nextRow.description
    }
    const next = [...list]
    next[idx] = nextRow
    localStorage.setItem(COOANC_CALENDAR_EVENTS_STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event(COOANC_CALENDAR_STORAGE_UPDATE_EVENT))
  } catch {
    /* JSON 손상 등은 무시 */
  }
}
