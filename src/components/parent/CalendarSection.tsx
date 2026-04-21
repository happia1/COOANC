'use client'

/**
 * 부모 루틴 탭 — 캘린더
 * - localStorage(cooanc_calendar_events_v1) 저장
 * - 「캘린더」제목·+ 버튼은 스페셜 미션처럼 흰 카드 밖 상단 한 줄(+는 오른쪽 끝) — + 로 일정 추가 바텀시트(EventSheet) 열기
 * - 공휴일·방학·기념일·기타 범례 칩은 한 줄 가로 스크롤; **탭하면 해당 유형만** 필터(같은 칩 다시 탭하면 해제). 선택 칩은 **색만 진하게**(테두리 링 없음).
 * - 날짜 탭: 해당 날 일정이 있으면 상세 슬라이드, 없으면 빈 상태 시트 +「일정등록하기」(헤더 +와 동일 EventSheet, 클릭한 날짜로 시작·종료일 채움)
 * - 일정 상세 시트 헤더 오른쪽 + : 헤더와 같은 EventSheet(일정 추가)를 연 뒤 상세는 닫음
 * - 「이번 달 일정」은 **항상** 같은 줄에 표시(일정 0건이어도 숨기지 않음). 펼치면 목록 또는 빈 안내.
 * - 흰 카드는 `pb-4`(작은 하단 여백)만 둠.
 * - 시트 z-index는 하단 독바(z-50)보다 위로 두어 저장 버튼이 가리지 않게 함
 */

import { useState, useEffect, useCallback } from 'react'
import type { LocalCalendarEvent } from '@/types/database'
import { getSeoulDateString } from '@/lib/koreaDate'
import { COOANC_CALENDAR_EVENTS_STORAGE_KEY } from '@/lib/localStorageChildScope'
import { COOANC_CALENDAR_STORAGE_UPDATE_EVENT } from '@/lib/syncAgentEventToLocalCalendar'
import { createClient } from '@/lib/supabase/client'

const STORAGE_KEY = COOANC_CALENDAR_EVENTS_STORAGE_KEY

const EVENT_COLORS: Record<LocalCalendarEvent['eventType'], { bg: string; text: string; dot: string }> = {
  holiday: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
  vacation: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400' },
  special: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  other: { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' },
  /** 행사 — 초록 톤(학교·기관 행사 등) */
  event: { bg: 'bg-emerald-50', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  /** 여행 — 하늘색 톤 */
  travel: { bg: 'bg-sky-50', text: 'text-sky-800', dot: 'bg-sky-500' },
}

/** 범례 칩만: 필터 선택 시 배경·글자·점을 한 단계 진하게(다시 누르면 EVENT_COLORS 와 동일 톤으로 복귀) */
const EVENT_LEGEND_CHIP_SELECTED: Record<LocalCalendarEvent['eventType'], { bg: string; text: string; dot: string }> = {
  holiday: { bg: 'bg-red-200', text: 'text-red-900', dot: 'bg-red-600' },
  vacation: { bg: 'bg-blue-200', text: 'text-blue-900', dot: 'bg-blue-600' },
  special: { bg: 'bg-yellow-200', text: 'text-yellow-900', dot: 'bg-yellow-600' },
  other: { bg: 'bg-gray-300', text: 'text-gray-900', dot: 'bg-gray-600' },
  event: { bg: 'bg-emerald-200', text: 'text-emerald-950', dot: 'bg-emerald-600' },
  travel: { bg: 'bg-sky-200', text: 'text-sky-950', dot: 'bg-sky-600' },
}

/** 표시 전용 이름 (special = 기념일, other = 그 외 일정) */
const EVENT_TYPE_LABELS: Record<LocalCalendarEvent['eventType'], string> = {
  holiday: '공휴일',
  vacation: '방학',
  special: '기념일',
  other: '기타',
  event: '행사',
  travel: '여행',
}

/** 범례·일정 시트에서 쓰는 종류 순서 */
const EVENT_TYPES_ORDER: LocalCalendarEvent['eventType'][] = [
  'holiday',
  'vacation',
  'special',
  'event',
  'travel',
  'other',
]

type OverrideType = LocalCalendarEvent['routineOverride']

interface Props {
  childId: string | null
}

function dateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** YYYY-MM-DD → "2026년 4월 6일" (시트 제목용) */
function formatDateKeyKorean(dk: string): string {
  const [y, m, d] = dk.split('-').map(Number)
  if (!y || !m || !d) return dk
  return `${y}년 ${m}월 ${d}일`
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

/** 달력 칸 폭 한정: 공휴일 이름은 5글자 이하이면 그대로, 초과 시 앞 4글자 + '..' (예: 부처님오신날 → 부처님오.., 노동절 → 노동절) */
const PUBLIC_HOLIDAY_CELL_LABEL_MAX_CHARS = 5

function shortPublicHolidayCellLabel(full: string): string {
  const chars = Array.from(full.trim())
  if (chars.length <= PUBLIC_HOLIDAY_CELL_LABEL_MAX_CHARS) return chars.join('')
  return `${chars.slice(0, 4).join('')}..`
}

type SheetState = {
  startDate: string
  endDate: string
  existing?: LocalCalendarEvent
  presetType?: LocalCalendarEvent['eventType']
}

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
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [detailEvents, setDetailEvents] = useState<LocalCalendarEvent[] | null>(null)
  /** 일정이 없는 날을 눌렀을 때만 값이 있음(빈 날 시트 표시) */
  const [emptyDayKey, setEmptyDayKey] = useState<string | null>(null)
  /** 이번 달 일정 목록: 처음엔 접어 두고, 같은 줄 오른쪽 화살표로 펼침 */
  const [monthScheduleOpen, setMonthScheduleOpen] = useState(false)
  /** 상단 범례(유형 칩) 선택 시: null 이면 전체, 값이면 그 eventType 만 달력·목록에 표시 */
  const [legendFilter, setLegendFilter] = useState<LocalCalendarEvent['eventType'] | null>(null)
  /** `public_holidays` 에서 읽은 법정 공휴일 이름 — 날짜 키(YYYY-MM-DD) → 표시명 */
  const [holidayNamesByDate, setHolidayNamesByDate] = useState<Record<string, string>>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setEvents(JSON.parse(raw))
    } catch {
      /* ignore */
    }
  }, [])

  /** 루틴 도우미 등이 `localStorage` 를 갱신하면 같은 탭에서도 목록을 다시 읽습니다 */
  useEffect(() => {
    const reloadFromStorage = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) setEvents(JSON.parse(raw))
      } catch {
        /* ignore */
      }
    }
    window.addEventListener(COOANC_CALENDAR_STORAGE_UPDATE_EVENT, reloadFromStorage)
    window.addEventListener('storage', reloadFromStorage)
    return () => {
      window.removeEventListener(COOANC_CALENDAR_STORAGE_UPDATE_EVENT, reloadFromStorage)
      window.removeEventListener('storage', reloadFromStorage)
    }
  }, [])

  /** Supabase `public_holidays` — 이번 달 법정 공휴일만 읽어 달력에 빨간 이름으로 표시 */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const supabase = createClient()
        const pad = (n: number) => String(n).padStart(2, '0')
        const ym = `${year}-${pad(month + 1)}`
        const start = `${ym}-01`
        const lastD = new Date(year, month + 1, 0).getDate()
        const end = `${ym}-${pad(lastD)}`
        const { data, error } = await supabase
          .from('public_holidays')
          .select('date,name')
          .gte('date', start)
          .lte('date', end)
        if (cancelled) return
        if (error || !data) {
          setHolidayNamesByDate({})
          return
        }
        const map: Record<string, string> = {}
        for (const row of data as { date: string; name: string }[]) {
          map[String(row.date).slice(0, 10)] = row.name
        }
        setHolidayNamesByDate(map)
      } catch {
        if (!cancelled) setHolidayNamesByDate({})
      }
    })()
    return () => {
      cancelled = true
    }
  }, [year, month])

  const saveEvents = useCallback(
    (updated: LocalCalendarEvent[] | ((prev: LocalCalendarEvent[]) => LocalCalendarEvent[])) => {
      setEvents((prev) => {
        const next = typeof updated === 'function' ? updated(prev) : updated
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        return next
      })
    },
    [],
  )

  const todayStr = getSeoulDateString()

  /** 이번 달·현재 아이에 해당하는 일정(필터 적용 전) */
  const monthEventsAll = events.filter((ev) => {
    if (ev.childId && ev.childId !== childId) return false
    return datesInRange(ev.startDate, ev.endDate).some((d) => {
      const [y, m] = d.split('-').map(Number)
      return y === year && m - 1 === month
    })
  })
  /** 범례에서 한 유형만 골랐을 때: 달력 점·날짜 탭 상세·「이번 달 일정」목록 모두 이 목록 기준 */
  const monthEvents = legendFilter
    ? monthEventsAll.filter((ev) => ev.eventType === legendFilter)
    : monthEventsAll

  const dateEventMap: Record<string, LocalCalendarEvent[]> = {}
  for (const ev of monthEvents) {
    for (const d of datesInRange(ev.startDate, ev.endDate)) {
      if (!dateEventMap[d]) dateEventMap[d] = []
      dateEventMap[d].push(ev)
    }
  }
  /**
   * 법정 공휴일(`public_holidays`)은 별도 localStorage 행 없이도 **공휴일(빨간) 점**이 찍히게 합니다.
   * id 는 `__public_holiday__:` 로 시작해 일반 일정과 구분합니다(일정 상세에서는 읽기 전용으로 표시).
   * 다른 유형만 필터한 상태에서는 범례와 맞추기 위해 공휴일 점은 넣지 않습니다.
   */
  const showPublicHolidayDots = legendFilter == null || legendFilter === 'holiday'
  if (showPublicHolidayDots) {
    for (const dk of Object.keys(holidayNamesByDate)) {
      const parts = dk.split('-').map(Number)
      const yv = parts[0]
      const mv = parts[1]
      if (yv !== year || mv - 1 !== month) continue
      const nm = holidayNamesByDate[dk]
      if (!nm) continue
      const syn: LocalCalendarEvent = {
        id: `__public_holiday__:${dk}`,
        childId: null,
        title: nm,
        startDate: dk,
        endDate: dk,
        eventType: 'holiday',
        routineOverride: 'none',
      }
      const cur = dateEventMap[dk] ?? []
      if (!cur.some((e) => e.id.startsWith('__public_holiday__:'))) {
        dateEventMap[dk] = [syn, ...cur]
      }
    }
  }

  const firstDay = new Date(year, month, 1).getDay()
  const daysCount = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysCount }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  function handleDayClick(dk: string) {
    const raw = dateEventMap[dk] ?? []
    /** 사용자가 등록한 일정만(법정 공휴일 가짜 행은 아래에서 따로 붙임) */
    const userOnly = raw.filter((e) => !e.id.startsWith('__public_holiday__:'))
    const fromMap = raw.find((e) => e.id.startsWith('__public_holiday__:'))
    const phName = holidayNamesByDate[dk]?.trim()
    /** 범례에서 공휴일 점을 뺀 달에도, DB 에 이름이 있으면 세부 시트에 표시 */
    const publicHolidayEv: LocalCalendarEvent | null =
      fromMap ??
      (phName
        ? {
            id: `__public_holiday__:${dk}`,
            childId: null,
            title: phName,
            startDate: dk,
            endDate: dk,
            eventType: 'holiday',
            routineOverride: 'none',
          }
        : null)

    const byId = new Map(userOnly.map((e) => [e.id, e]))
    const uniqUser = [...byId.values()]
    const detailList: LocalCalendarEvent[] = publicHolidayEv ? [publicHolidayEv, ...uniqUser] : uniqUser

    if (detailList.length > 0) {
      setEmptyDayKey(null)
      setDetailEvents(detailList)
    } else {
      setDetailEvents(null)
      setEmptyDayKey(dk)
    }
  }

  /** 헤더 + 버튼: 오늘 날짜로 일정 추가 시트(날짜는 시트 안에서 바꿀 수 있음) */
  function openAddSheet() {
    setEmptyDayKey(null)
    setSheet({ startDate: todayStr, endDate: todayStr })
  }

  function closeSheet() {
    setSheet(null)
  }

  function prevMonth() {
    if (month === 0) {
      setYear((y) => y - 1)
      setMonth(11)
    } else setMonth((m) => m - 1)
  }
  function nextMonth() {
    if (month === 11) {
      setYear((y) => y + 1)
      setMonth(0)
    } else setMonth((m) => m + 1)
  }

  /** 범례 칩: 같은 유형을 다시 누르면 필터 해제(전체 보기) */
  function toggleLegendFilter(type: LocalCalendarEvent['eventType']) {
    setLegendFilter((cur) => (cur === type ? null : type))
  }

  return (
    <section className="w-full">
      {/* 스페셜 미션과 동일: 섹션 제목은 카드 밖, 액션(+ )는 같은 줄 오른쪽 끝 */}
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-gray-800">캘린더</h2>
        <button
          type="button"
          onClick={openAddSheet}
          className="shrink-0 px-1 text-2xl font-light leading-none text-[#4A90E2] transition-opacity active:opacity-60"
          aria-label="일정 추가"
        >
          +
        </button>
      </div>

      {/* pb-4: 이번 달 일정 아래·카드 하단 여백을 최소로(요청에 따라 pb-10 → 더 축소). FAB과 겹치면 pb-6 등으로만 살짝 늘리면 됨 */}
      <div className="w-full rounded-2xl bg-white px-4 pt-4 pb-4 shadow-sm">
      {/* 범례: 한 줄 가로 스크롤 — 스크롤바 UI는 숨김(웹킷·파이어폭스·구형 Edge) */}
      <div
        className="mb-3 flex snap-x snap-proximity touch-pan-x gap-2 overflow-x-auto overscroll-x-contain pb-0.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label="일정 유형 범례 — 칩을 누르면 해당 유형만 표시"
      >
        {EVENT_TYPES_ORDER.map((type) => {
          const selected = legendFilter === type
          const chip = selected ? EVENT_LEGEND_CHIP_SELECTED[type] : EVENT_COLORS[type]
          return (
            <button
              key={type}
              type="button"
              role="listitem"
              aria-pressed={selected}
              aria-label={
                selected
                  ? `${EVENT_TYPE_LABELS[type]} 필터 해제하고 전체 보기`
                  : `${EVENT_TYPE_LABELS[type]}만 달력에 표시`
              }
              onClick={() => toggleLegendFilter(type)}
              className={[
                'inline-flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors duration-150 active:opacity-90',
                chip.bg,
                chip.text,
              ].join(' ')}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${chip.dot}`} aria-hidden />
              {EVENT_TYPE_LABELS[type]}
            </button>
          )
        })}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="flex min-h-9 min-w-9 items-center justify-center text-2xl font-light leading-none text-gray-400 transition-opacity active:opacity-50"
          aria-label="이전 달"
        >
          ‹
        </button>
        <p className="font-bold text-brand-text">
          {year}년 {month + 1}월
        </p>
        <button
          type="button"
          onClick={nextMonth}
          className="flex min-h-9 min-w-9 items-center justify-center text-2xl font-light leading-none text-gray-400 transition-opacity active:opacity-50"
          aria-label="다음 달"
        >
          ›
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7">
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
          <div
            key={d}
            className={`pb-1 text-center text-[10px] font-bold ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* gap-y-2: 행 사이 여백을 조금 넓혀 도트가 있어도 답답하지 않게 함 */}
      <div className="grid grid-cols-7 gap-y-2">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />
          const dk = dateKey(year, month, day)
          const evHere = dateEventMap[dk] ?? []
          const isToday = dk === todayStr
          const isSun = idx % 7 === 0
          const isSat = idx % 7 === 6
          const publicHolidayName = holidayNamesByDate[dk]
          /** 같은 날 중복 id 제거 후 최대 3개만 점으로 표시 */
          const dotEvents = [...new Map(evHere.map((e) => [e.id, e])).values()].slice(0, 3)
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleDayClick(dk)}
              className={[
                /* py-1.5: 숫자 줄·도트 슬롯을 포함해 모든 날짜 칸 높이를 통일하기 위한 여백 */
                'relative flex flex-col items-center rounded-lg py-1.5 text-[11px] font-bold transition-all',
                isToday ? 'ring-2 ring-brand-blue' : '',
                'hover:bg-gray-50',
                isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-700',
              ].join(' ')}
            >
              {day}
              {publicHolidayName ? (
                <span
                  className="mt-0.5 block w-full min-w-0 max-w-[3.25rem] overflow-hidden whitespace-nowrap text-ellipsis px-0.5 text-center text-[10px] font-bold leading-none text-red-600"
                  title={publicHolidayName}
                >
                  {shortPublicHolidayCellLabel(publicHolidayName)}
                </span>
              ) : null}
              {/*
                일정이 없는 날도 같은 높이의 ‘도트 자리’를 항상 두어,
                점이 생겼을 때만 행 높이가 커지는 현상(줄 간격 들쭉날쭉)을 막습니다.
                h-3 안에 h-1 도트: 작은 점이라 한 줄에 3개가 들어가기 쉽고, 줄 높이 변화도 최소화됩니다.
              */}
              <div
                className="mt-0.5 flex h-3 w-full flex-nowrap items-center justify-center gap-px overflow-hidden"
                aria-hidden={dotEvents.length === 0}
              >
                {dotEvents.map((ev) => (
                  <span
                    key={ev.id}
                    className={`h-1 w-1 shrink-0 rounded-full ${EVENT_COLORS[ev.eventType].dot}`}
                  />
                ))}
              </div>
            </button>
          )
        })}
      </div>

      {/*
        이번 달 일정: 일정이 0건이어도 헤더·토글은 항상 보이게(이전에는 monthEvents.length > 0 일 때만 렌더되어 사라짐).
      */}
      <div className="mt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold text-gray-400">이번 달 일정</p>
          <button
            type="button"
            onClick={() => setMonthScheduleOpen((o) => !o)}
            className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors active:bg-gray-100"
            aria-expanded={monthScheduleOpen}
            aria-label={monthScheduleOpen ? '이번 달 일정 접기' : '이번 달 일정 펼치기'}
          >
            <svg
              className={`h-5 w-5 transition-transform duration-200 ${monthScheduleOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
        {monthScheduleOpen ? (
          <div className="mt-2 flex flex-col gap-2">
            {monthEvents.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-3 py-3 text-center text-[10px] font-bold text-gray-400">
                {monthEventsAll.length === 0
                  ? '이번 달 등록된 일정이 없어요'
                  : legendFilter
                    ? `${EVENT_TYPE_LABELS[legendFilter]} 일정은 이번 달에 없어요. 위 칩을 다시 누르면 전체를 볼 수 있어요`
                    : '이번 달 등록된 일정이 없어요'}
              </p>
            ) : (
              monthEvents.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => setDetailEvents([ev])}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left ${EVENT_COLORS[ev.eventType].bg}`}
                >
                  <div className="min-w-0">
                    <p className={`truncate text-xs font-bold ${EVENT_COLORS[ev.eventType].text}`}>{ev.title}</p>
                    <p className="text-[10px] text-gray-500">
                      {ev.startDate} ~ {ev.endDate}
                      &nbsp;·&nbsp;
                      {ev.routineOverride === 'none' ? '미션 없음' : '휴일 루틴 적용'}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold text-gray-400">상세</span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
      </div>

      {sheet && (
        <EventSheet
          key={sheet.existing?.id ?? `new-${sheet.startDate}-${sheet.presetType ?? 'p'}`}
          initialStartDate={sheet.startDate}
          initialEndDate={sheet.endDate}
          existing={sheet.existing}
          presetEventType={sheet.presetType}
          childId={childId}
          onSave={(ev) => {
            saveEvents((prev) =>
              sheet.existing ? prev.map((e) => (e.id === ev.id ? ev : e)) : [...prev, ev],
            )
            closeSheet()
          }}
          onDelete={
            sheet.existing
              ? (id) => {
                  saveEvents((prev) => prev.filter((e) => e.id !== id))
                  closeSheet()
                }
              : undefined
          }
          onClose={closeSheet}
        />
      )}

      {detailEvents && detailEvents.length > 0 && (
        <EventDetailBottomSheet
          events={detailEvents}
          onClose={() => setDetailEvents(null)}
          onAddSchedule={() => {
            setDetailEvents(null)
            openAddSheet()
          }}
          onEdit={(ev) => {
            setDetailEvents(null)
            setSheet({ startDate: ev.startDate, endDate: ev.endDate, existing: ev })
          }}
          onDelete={(id) => {
            saveEvents((prev) => prev.filter((e) => e.id !== id))
            setDetailEvents((prev) => {
              if (!prev) return null
              const next = prev.filter((e) => e.id !== id)
              return next.length > 0 ? next : null
            })
          }}
        />
      )}

      {emptyDayKey && (
        <EmptyDayBottomSheet
          dateKey={emptyDayKey}
          onClose={() => setEmptyDayKey(null)}
          onAddSchedule={(dk) => {
            setEmptyDayKey(null)
            setSheet({ startDate: dk, endDate: dk })
          }}
        />
      )}
    </section>
  )
}

function EventSheet({
  initialStartDate,
  initialEndDate,
  existing,
  presetEventType,
  childId,
  onSave,
  onDelete,
  onClose,
}: {
  initialStartDate: string
  initialEndDate: string
  existing?: LocalCalendarEvent
  presetEventType?: LocalCalendarEvent['eventType']
  childId: string | null
  onSave: (ev: LocalCalendarEvent) => void
  onDelete?: (id: string) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(existing?.title ?? '')
  const [startDate, setStart] = useState(existing?.startDate ?? initialStartDate)
  const [endDate, setEnd] = useState(existing?.endDate ?? initialEndDate)
  const [eventType, setType] = useState<LocalCalendarEvent['eventType']>(
    existing?.eventType ?? presetEventType ?? 'holiday',
  )
  const [override, setOverride] = useState<OverrideType>(existing?.routineOverride ?? 'weekend')
  // 구버전 일정(JSON)에는 description 키가 없을 수 있음 → 빈 문자열로 시작
  const [description, setDescription] = useState(existing?.description ?? '')

  function handleSave() {
    if (!title.trim()) return
    const trimmedNote = description.trim()
    onSave({
      id: existing?.id ?? crypto.randomUUID(),
      childId,
      title: title.trim(),
      ...(trimmedNote ? { description: trimmedNote } : {}),
      startDate,
      endDate,
      eventType,
      routineOverride: override,
    })
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-sheet-title"
    >
      {/* 독바(z-50)보다 위 레이어 + 하단 버튼은 고정 푸터로 분리해 가림 방지 */}
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="닫기" onClick={onClose} />
      <div
        className="relative flex max-h-[min(88dvh,100vh-2rem)] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-200" aria-hidden />
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 pt-4">
          <p id="event-sheet-title" className="text-base font-black text-brand-text">
            {existing ? '일정 편집' : '일정 추가'}
          </p>

          <div className="mt-4">
            <label className="mb-1 block text-xs font-bold text-gray-500">일정 이름</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 여름방학"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-500">시작일</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStart(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-500">종료일</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-xs font-bold text-gray-500">이벤트 종류</label>
            {/* 네 칸은 한 줄에 넣기 어려워 2×2 그리드 */}
            <div className="grid grid-cols-2 gap-2">
              {EVENT_TYPES_ORDER.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setType(type)}
                  className={`rounded-xl border-2 py-2.5 text-xs font-bold transition-all ${
                    eventType === type
                      ? `border-current ${EVENT_COLORS[type].bg} ${EVENT_COLORS[type].text}`
                      : 'border-gray-200 text-gray-400'
                  }`}
                >
                  {EVENT_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-xs font-bold text-gray-500">루틴 적용</label>
            <div className="flex gap-2">
              {(['weekend', 'none'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setOverride(v)}
                  className={`flex-1 rounded-xl border-2 py-2 text-xs font-bold transition-all ${
                    override === v ? 'border-brand-blue bg-brand-blue/10 text-brand-blue' : 'border-gray-200 text-gray-400'
                  }`}
                >
                  {v === 'weekend' ? '휴일 루틴 적용' : '미션 없음'}
                </button>
              ))}
            </div>
          </div>

          {/* 루틴 설정 아래: 부가 정보(여러 줄 가능) */}
          <div className="mt-4">
            <label htmlFor="calendar-event-description" className="mb-1 block text-xs font-bold text-gray-500">
              간단한 설명
            </label>
            <textarea
              id="calendar-event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예: 준비물 챙기기, 장소 안내 등"
              rows={3}
              className="w-full resize-y rounded-xl border border-gray-200 px-4 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
            />
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex gap-2">
            {onDelete && existing && (
              <button
                type="button"
                onClick={() => onDelete(existing.id)}
                className="rounded-2xl border border-red-200 px-3 py-3 text-sm font-bold text-red-500"
              >
                삭제
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-bold text-gray-500"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!title.trim()}
              className="flex-1 rounded-2xl bg-brand-blue py-3 text-sm font-bold text-white shadow-md active:scale-95 disabled:opacity-50"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 선택한 날에 일정이 하나도 없을 때 뜨는 하단 시트
 * -「일정등록하기」는 헤더 +와 같은 EventSheet 를 연다(클릭한 날이 시작·종료일로 미리 채워짐)
 */
function EmptyDayBottomSheet({
  dateKey,
  onClose,
  onAddSchedule,
}: {
  dateKey: string
  onClose: () => void
  onAddSchedule: (dk: string) => void
}) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="닫기" onClick={onClose} />
      <div
        className="relative flex max-h-[min(85dvh,100vh-2rem)] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-200" aria-hidden />
        <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-2">
          <p className="mb-1 text-center text-base font-black text-brand-text">{formatDateKeyKorean(dateKey)}</p>
          <p className="mb-4 text-center text-xs text-gray-500">이 날짜에 등록된 일정이 없어요</p>
          <button
            type="button"
            onClick={() => onAddSchedule(dateKey)}
            className="w-full rounded-2xl bg-brand-blue py-3.5 text-sm font-bold text-white shadow-md active:scale-[0.98]"
          >
            일정등록하기
          </button>
        </div>

        <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-gray-200 py-3 text-sm font-bold text-gray-600"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

function EventDetailBottomSheet({
  events,
  onClose,
  onAddSchedule,
  onEdit,
  onDelete,
}: {
  events: LocalCalendarEvent[]
  onClose: () => void
  /** 헤더 + : 캘린더 상단 +와 동일한 일정 추가(EventSheet) 시트 */
  onAddSchedule: () => void
  onEdit: (ev: LocalCalendarEvent) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="닫기" onClick={onClose} />
      <div
        className="relative flex max-h-[min(85dvh,100vh-2rem)] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-200" aria-hidden />
        <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-2">
          {/* 제목은 가운데, +는 오른쪽(캘린더 헤더 +와 같은 스타일·동작) */}
          <div className="relative mb-3 flex min-h-7 items-center justify-center">
            <p className="text-base font-black text-brand-text">일정 상세</p>
            <button
              type="button"
              onClick={onAddSchedule}
              className="absolute right-0 shrink-0 px-1 text-2xl font-light leading-none text-[#4A90E2] transition-opacity active:opacity-60"
              aria-label="일정 추가"
            >
              +
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {events.map((ev) => {
              /** 캘린더가 만든 법정 공휴일 행 — localStorage 에 없으므로 편집·삭제 불가 */
              const isReadonlyPublicHoliday = ev.id.startsWith('__public_holiday__:')
              return (
              <div
                key={ev.id}
                className={`rounded-2xl border border-gray-100 p-3 ${EVENT_COLORS[ev.eventType].bg}`}
              >
                <p className={`text-sm font-black ${EVENT_COLORS[ev.eventType].text}`}>{ev.title}</p>
                {isReadonlyPublicHoliday ? (
                  <>
                    {/* 법정 공휴일은 요청에 맞춰 최소 정보(이름 + 분류)만 단순 표시합니다. */}
                    <p className="mt-1 text-[11px] font-bold text-gray-600">법정공휴일</p>
                  </>
                ) : (
                <>
                <p className="mt-1 text-[11px] font-bold text-gray-600">{EVENT_TYPE_LABELS[ev.eventType]}</p>
                <p className="mt-1 text-xs text-gray-600">
                  기간: {ev.startDate} ~ {ev.endDate}
                </p>
                <p className="mt-0.5 text-xs text-gray-600">
                  루틴: {ev.routineOverride === 'none' ? '미션 없음' : '휴일 루틴 적용'}
                </p>
                {ev.description?.trim() && (
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-gray-600">{ev.description.trim()}</p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(ev)}
                    className="flex-1 rounded-xl bg-brand-blue py-2.5 text-xs font-bold text-white"
                  >
                    편집
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(ev.id)}
                    className="rounded-xl border border-red-200 px-4 py-2.5 text-xs font-bold text-red-500"
                  >
                    삭제
                  </button>
                </div>
                </>
                )}
              </div>
              )
            })}
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-gray-200 py-3 text-sm font-bold text-gray-600"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
