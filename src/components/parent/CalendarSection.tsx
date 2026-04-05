'use client'

/**
 * 부모 루틴 탭 하단 캘린더 섹션
 * - 월간 뷰, 날짜/범위 선택 → 이벤트 추가 시트
 * - 공휴일(빨강) / 방학(파랑) / 특별일정(노랑) 색상 표시
 * - 저장: localStorage (cooanc_calendar_events_v1) — 추후 Supabase 마이그레이션 예정
 * - "오늘 루틴 수동 전환" 버튼: 오늘 하루만 휴일/미션없음으로 변경
 */

import { useState, useEffect, useCallback } from 'react'
import type { LocalCalendarEvent } from '@/types/database'
import { getSeoulDateString } from '@/lib/koreaDate'
import { COOANC_CALENDAR_EVENTS_STORAGE_KEY } from '@/lib/localStorageChildScope'

const STORAGE_KEY = COOANC_CALENDAR_EVENTS_STORAGE_KEY

const EVENT_COLORS: Record<LocalCalendarEvent['eventType'], { bg: string; text: string; dot: string }> = {
  holiday:  { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-400' },
  vacation: { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-400' },
  special:  { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-400' },
}

const EVENT_TYPE_LABELS: Record<LocalCalendarEvent['eventType'], string> = {
  holiday:  '🔴 공휴일',
  vacation: '🔵 방학',
  special:  '🟡 특별일정',
}

type OverrideType = LocalCalendarEvent['routineOverride']

interface Props {
  childId: string | null
}

// ── 유틸 ────────────────────────────────────────────────────

function dateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function datesInRange(start: string, end: string): string[] {
  const result: string[] = []
  const cur = parseDate(start)
  const last = parseDate(end)
  while (cur <= last) {
    result.push(dateKey(cur.getFullYear(), cur.getMonth(), cur.getDate()))
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

// ── 메인 ────────────────────────────────────────────────────

export default function CalendarSection({ childId }: Props) {
  const [year, setYear] = useState(() => {
    const s = getSeoulDateString()
    return Number(s.slice(0, 4))
  })
  const [month, setMonth] = useState(() => {
    const s = getSeoulDateString()
    return Number(s.slice(5, 7)) - 1
  })

  const [events, setEvents] = useState<LocalCalendarEvent[]>([])

  // 날짜 선택 (범위)
  const [selStart, setSelStart] = useState<string | null>(null)
  const [selEnd,   setSelEnd]   = useState<string | null>(null)
  const [hovering, setHovering] = useState<string | null>(null)

  // 이벤트 추가/수정 시트
  const [sheet, setSheet] = useState<{
    startDate: string; endDate: string
    existing?: LocalCalendarEvent
  } | null>(null)

  // 오늘 수동 전환 시트
  const [todayOverrideSheet, setTodayOverrideSheet] = useState(false)

  // localStorage 로드
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setEvents(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  const saveEvents = useCallback((updated: LocalCalendarEvent[]) => {
    setEvents(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }, [])

  // 이 달 이벤트 필터 (childId 일치 or 전체)
  const monthEvents = events.filter(ev => {
    if (ev.childId && ev.childId !== childId) return false
    const inMonth = datesInRange(ev.startDate, ev.endDate).some(d => {
      const [y, m] = d.split('-').map(Number)
      return y === year && m - 1 === month
    })
    return inMonth
  })

  // 날짜 → 이벤트 맵
  const dateEventMap: Record<string, LocalCalendarEvent[]> = {}
  for (const ev of monthEvents) {
    for (const d of datesInRange(ev.startDate, ev.endDate)) {
      if (!dateEventMap[d]) dateEventMap[d] = []
      dateEventMap[d].push(ev)
    }
  }

  // 선택 범위 계산
  const rangeStart = selStart && selEnd
    ? (selStart <= selEnd ? selStart : selEnd)
    : selStart
  const rangeEnd = selStart && selEnd
    ? (selStart <= selEnd ? selEnd : selStart)
    : (hovering && selStart ? (selStart <= hovering ? hovering : selStart) : selStart)

  function inSelRange(d: string): boolean {
    if (!rangeStart) return false
    const re = rangeEnd ?? rangeStart
    return d >= (rangeStart <= re ? rangeStart : re) && d <= (rangeStart <= re ? re : rangeStart)
  }

  // 달력 셀 생성
  const firstDay  = new Date(year, month, 1).getDay()   // 0=Sun
  const daysCount = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysCount }, (_, i) => i + 1),
  ]
  // 6행 맞추기
  while (cells.length % 7 !== 0) cells.push(null)

  function handleDayClick(d: string) {
    if (!selStart) {
      setSelStart(d)
      setSelEnd(null)
    } else if (!selEnd) {
      const start = selStart <= d ? selStart : d
      const end   = selStart <= d ? d : selStart
      setSelEnd(end)
      setSelStart(start)
      setSheet({ startDate: start, endDate: end })
    } else {
      // 이미 선택된 날 클릭 → 이벤트 있으면 편집
      const evs = dateEventMap[d]
      if (evs && evs.length > 0) {
        setSheet({ startDate: evs[0].startDate, endDate: evs[0].endDate, existing: evs[0] })
      } else {
        setSelStart(d); setSelEnd(null)
      }
    }
  }

  function closeSheet() {
    setSheet(null)
    setSelStart(null)
    setSelEnd(null)
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
  }

  const todayStr = getSeoulDateString()

  return (
    <section className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-black text-brand-text">📅 방학 · 공휴일 캘린더</p>
        <button
          onClick={() => setTodayOverrideSheet(true)}
          className="text-xs font-bold bg-amber-50 text-amber-600 px-3 py-1.5 rounded-full border border-amber-200 active:scale-95 transition-all">
          오늘 루틴 전환
        </button>
      </div>

      {/* 범례 */}
      <div className="flex gap-3 mb-3 flex-wrap">
        {(Object.entries(EVENT_TYPE_LABELS) as [LocalCalendarEvent['eventType'], string][]).map(([type, label]) => (
          <span key={type} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${EVENT_COLORS[type].bg} ${EVENT_COLORS[type].text}`}>
            {label}
          </span>
        ))}
      </div>

      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 active:scale-90">‹</button>
        <p className="font-bold text-brand-text">{year}년 {month + 1}월</p>
        <button onClick={nextMonth} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 active:scale-90">›</button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-1">
        {['일','월','화','수','목','금','토'].map((d, i) => (
          <div key={d} className={`text-center text-[10px] font-bold pb-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{d}</div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />
          const dk = dateKey(year, month, day)
          const evHere = dateEventMap[dk] ?? []
          const isToday = dk === todayStr
          const inRange = inSelRange(dk)
          const isSun = idx % 7 === 0
          const isSat = idx % 7 === 6
          return (
            <button
              key={idx}
              onClick={() => handleDayClick(dk)}
              onMouseEnter={() => selStart && !selEnd && setHovering(dk)}
              onMouseLeave={() => setHovering(null)}
              className={[
                'relative flex flex-col items-center py-1 rounded-lg transition-all text-[11px] font-bold',
                isToday   ? 'ring-2 ring-brand-blue' : '',
                inRange   ? 'bg-brand-blue/10' : 'hover:bg-gray-50',
                isSun     ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-700',
              ].join(' ')}>
              {day}
              {/* 이벤트 도트 */}
              {evHere.length > 0 && (
                <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                  {evHere.slice(0, 3).map((ev, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${EVENT_COLORS[ev.eventType].dot}`}/>
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <p className="text-[10px] text-gray-400 mt-2 text-center">
        날짜를 탭하면 시작일, 다시 탭하면 종료일을 선택해요
      </p>

      {/* 이벤트 목록 (이번 달) */}
      {monthEvents.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-[11px] font-bold text-gray-400">이번 달 일정</p>
          {monthEvents.map(ev => (
            <div key={ev.id}
              className={`flex items-center justify-between px-3 py-2 rounded-xl ${EVENT_COLORS[ev.eventType].bg}`}
              onClick={() => setSheet({ startDate: ev.startDate, endDate: ev.endDate, existing: ev })}>
              <div>
                <p className={`text-xs font-bold ${EVENT_COLORS[ev.eventType].text}`}>{ev.title}</p>
                <p className="text-[10px] text-gray-400">{ev.startDate} ~ {ev.endDate}
                  &nbsp;·&nbsp;{ev.routineOverride === 'none' ? '미션 없음' : '휴일루틴 적용'}
                </p>
              </div>
              <button onClick={e => { e.stopPropagation(); saveEvents(events.filter(e2 => e2.id !== ev.id)) }}
                className="text-gray-300 hover:text-red-400 ml-2 text-lg leading-none">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* 이벤트 추가/편집 시트 */}
      {sheet && (
        <EventSheet
          initialStartDate={sheet.startDate}
          initialEndDate={sheet.endDate}
          existing={sheet.existing}
          childId={childId}
          onSave={(ev) => {
            const updated = sheet.existing
              ? events.map(e => e.id === ev.id ? ev : e)
              : [...events, ev]
            saveEvents(updated)
            closeSheet()
          }}
          onDelete={sheet.existing ? (id) => { saveEvents(events.filter(e => e.id !== id)); closeSheet() } : undefined}
          onClose={closeSheet}
        />
      )}

      {/* 오늘 루틴 수동 전환 시트 */}
      {todayOverrideSheet && (
        <TodayOverrideSheet
          childId={childId}
          todayStr={todayStr}
          events={events}
          onSave={(ev) => { saveEvents([...events, ev]); setTodayOverrideSheet(false) }}
          onClose={() => setTodayOverrideSheet(false)}
        />
      )}
    </section>
  )
}

// ── 이벤트 추가/편집 시트 ────────────────────────────────────

function EventSheet({
  initialStartDate, initialEndDate, existing, childId,
  onSave, onDelete, onClose,
}: {
  initialStartDate: string; initialEndDate: string
  existing?: LocalCalendarEvent; childId: string | null
  onSave: (ev: LocalCalendarEvent) => void
  onDelete?: (id: string) => void
  onClose: () => void
}) {
  const [title, setTitle]       = useState(existing?.title ?? '')
  const [startDate, setStart]   = useState(existing?.startDate ?? initialStartDate)
  const [endDate, setEnd]       = useState(existing?.endDate   ?? initialEndDate)
  const [eventType, setType]    = useState<LocalCalendarEvent['eventType']>(existing?.eventType ?? 'holiday')
  const [override, setOverride] = useState<OverrideType>(existing?.routineOverride ?? 'weekend')

  function handleSave() {
    if (!title.trim()) return
    onSave({
      id:             existing?.id ?? crypto.randomUUID(),
      childId:        childId,
      title:          title.trim(),
      startDate,
      endDate,
      eventType,
      routineOverride: override,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-t-3xl p-6 shadow-2xl flex flex-col gap-4"
        onClick={e => e.stopPropagation()}>
        <p className="font-black text-brand-text text-base">{existing ? '일정 편집' : '일정 추가'}</p>

        <div>
          <label className="text-xs font-bold text-gray-500 block mb-1">일정 이름</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 여름방학"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40"/>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">시작일</label>
            <input type="date" value={startDate} onChange={e => setStart(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40"/>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">종료일</label>
            <input type="date" value={endDate} min={startDate} onChange={e => setEnd(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40"/>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 block mb-2">이벤트 종류</label>
          <div className="flex gap-2">
            {(Object.entries(EVENT_TYPE_LABELS) as [LocalCalendarEvent['eventType'], string][]).map(([type, label]) => (
              <button key={type} onClick={() => setType(type)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all ${eventType === type ? `border-current ${EVENT_COLORS[type].bg} ${EVENT_COLORS[type].text}` : 'border-gray-200 text-gray-400'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 block mb-2">루틴 적용</label>
          <div className="flex gap-2">
            {([['weekend','🌿 휴일루틴 적용'],['none','⛔ 미션 없음']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setOverride(v)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all ${override === v ? 'border-brand-blue bg-brand-blue/10 text-brand-blue' : 'border-gray-200 text-gray-400'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          {onDelete && existing && (
            <button onClick={() => onDelete(existing.id)}
              className="px-4 py-3 rounded-2xl border border-red-200 text-red-500 text-sm font-bold">삭제</button>
          )}
          <button onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-500">취소</button>
          <button onClick={handleSave} disabled={!title.trim()}
            className="flex-1 py-3 rounded-2xl bg-brand-blue text-white text-sm font-bold shadow-md active:scale-95 disabled:opacity-50">저장</button>
        </div>
      </div>
    </div>
  )
}

// ── 오늘 루틴 수동 전환 시트 ─────────────────────────────────

function TodayOverrideSheet({
  childId, todayStr, events, onSave, onClose,
}: {
  childId: string | null; todayStr: string
  events: LocalCalendarEvent[]
  onSave: (ev: LocalCalendarEvent) => void
  onClose: () => void
}) {
  // 이미 오늘 이벤트가 있으면 표시
  const existing = events.find(ev =>
    ev.startDate <= todayStr && ev.endDate >= todayStr &&
    (!ev.childId || ev.childId === childId)
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-6" onClick={onClose}>
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl text-center"
        onClick={e => e.stopPropagation()}>
        <p className="text-2xl mb-2">📅</p>
        <p className="font-black text-brand-text text-base mb-1">오늘 루틴 수동 전환</p>
        <p className="text-xs text-gray-400 mb-5">{todayStr}</p>

        {existing ? (
          <div className={`text-sm font-bold px-4 py-3 rounded-xl mb-4 ${EVENT_COLORS[existing.eventType].bg} ${EVENT_COLORS[existing.eventType].text}`}>
            현재: {existing.title} ({existing.routineOverride === 'none' ? '미션 없음' : '휴일루틴'})
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <button
            onClick={() => onSave({ id: crypto.randomUUID(), childId, title: '오늘 하루 휴일루틴', startDate: todayStr, endDate: todayStr, eventType: 'holiday', routineOverride: 'weekend' })}
            className="w-full py-3 rounded-2xl bg-brand-blue/10 text-brand-blue font-bold text-sm active:scale-95">
            🌿 오늘 휴일루틴으로 전환
          </button>
          <button
            onClick={() => onSave({ id: crypto.randomUUID(), childId, title: '오늘 미션 없음', startDate: todayStr, endDate: todayStr, eventType: 'holiday', routineOverride: 'none' })}
            className="w-full py-3 rounded-2xl bg-red-50 text-red-500 font-bold text-sm active:scale-95">
            ⛔ 오늘 미션 없음으로 전환
          </button>
          <button onClick={onClose} className="text-xs text-gray-400 underline mt-1">취소</button>
        </div>
      </div>
    </div>
  )
}
