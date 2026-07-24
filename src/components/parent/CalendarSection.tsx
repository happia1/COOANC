'use client'

/**
 * 부모 루틴 탭 — 캘린더
 * - 기기 `localStorage(cooanc_calendar_events_v1)` + 서버 `calendar_events` 를 **같이** 불러와 병합
 *   (홈 일정 브리핑과 동일 데이터를 캘린더에서도 보려는 목적)
 * - 「캘린더」제목·+ 버튼은 스페셜 미션처럼 흰 카드 밖 상단 한 줄(+는 오른쪽 끝) — + 로 일정 추가 바텀시트(EventSheet) 열기
 * - 범례 칩: **달 점·이번 달 목록**은 선택 유형에 맞춤. **칸 안 빨간 공휴일 이름**도 범례가 공휴일(또는 전체)일 때만 표시 —「여행만」이면 도트와 같이 공휴일 글자도 숨김.
 * - **날짜 상세**: 그날 저장·서버 일정 전부 + 법정 공휴일. `travel` 은 DB에 특정 `child_id`만 있어도 가족 여행으로 보고 **탭 자녀와 달라도** 표시(제주 등).
 * - 날짜 탭: 해당 날 일정이 있으면 상세 슬라이드, 없으면 빈 상태 시트 +「일정등록하기」. `?calendarDate=` 딥링크는 **서버·로컬 병합이 끝난 뒤**(`calendarDataRevision`)에만 자동 열어, 비어 있는 팝업이 먼저 뜨는 레이스를 막음.
 * - 일정 상세 시트 헤더 오른쪽 + : 헤더와 같은 EventSheet(일정 추가)를 연 뒤 상세는 닫음
 * - 「이번 달 일정」은 **항상** 표시(0건이어도). 블록 아무 곳(제목·빈 안내)이나 탭/스페이스로 펼침/접힘; 일정 행만 누르면 상세 시트.
 * - 흰 카드는 `pb-4`(작은 하단 여백)만 둠.
 * - 시트 z-index는 하단 독바(z-50)보다 위로 두어 저장 버튼이 가리지 않게 함
 */

import { useState, useEffect, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useRouter } from 'next/navigation'
import type { LocalCalendarEvent } from '@/types/database'
import { getSeoulDateString } from '@/lib/koreaDate'
import { COOANC_CALENDAR_EVENTS_STORAGE_KEY } from '@/lib/localStorageChildScope'
import { COOANC_CALENDAR_STORAGE_UPDATE_EVENT } from '@/lib/syncAgentEventToLocalCalendar'
import { createClient } from '@/lib/supabase/client'
import {
  dedupeMergedCalendarEventsByTitleAndStart,
  deleteParentCalendarEvent,
  fetchParentCalendarEventsFromServer,
  filterOutDeletedCalendarEvents,
  mergeServerAndLocalCalendar,
} from '@/lib/mergeParentCalendarEvents'

const STORAGE_KEY = COOANC_CALENDAR_EVENTS_STORAGE_KEY

const EVENT_COLORS: Record<LocalCalendarEvent['eventType'], { bg: string; text: string; dot: string }> = {
  holiday: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
  vacation: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400' },
  special: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  /** 생일 등 — 분홍 톤 */
  birthday: { bg: 'bg-rose-50', text: 'text-rose-800', dot: 'bg-rose-500' },
  /** 기타 라벨(etc 등) — DB etc */
  etc: { bg: 'bg-purple-50', text: 'text-purple-800', dot: 'bg-purple-500' },
  /** 개학일·등교일 등 학교 계열 일정 */
  school: { bg: 'bg-indigo-50', text: 'text-indigo-800', dot: 'bg-indigo-500' },
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
  birthday: { bg: 'bg-rose-200', text: 'text-rose-950', dot: 'bg-rose-600' },
  etc: { bg: 'bg-purple-200', text: 'text-purple-950', dot: 'bg-purple-600' },
  school: { bg: 'bg-indigo-200', text: 'text-indigo-950', dot: 'bg-indigo-600' },
  other: { bg: 'bg-gray-300', text: 'text-gray-900', dot: 'bg-gray-600' },
  event: { bg: 'bg-emerald-200', text: 'text-emerald-950', dot: 'bg-emerald-600' },
  travel: { bg: 'bg-sky-200', text: 'text-sky-950', dot: 'bg-sky-600' },
}

/** 표시 전용 이름 — special/event·etc/other 는 UI 에서 통합 라벨 */
const EVENT_TYPE_LABELS: Record<LocalCalendarEvent['eventType'], string> = {
  holiday: '공휴일',
  vacation: '방학',
  birthday: '생일',
  etc: '기타',
  school: '학교',
  special: '기념일/행사',
  other: '기타',
  event: '기념일/행사',
  travel: '여행',
}

/**
 * 일정 추가·편집 시트 — 이벤트 종류 칩 (한 줄에 여러 개, etc/other·special/event 통합)
 * `value` 는 저장 시 DB `event_type` 으로 씁니다.
 */
const EVENT_TYPE_PICKER_OPTIONS: {
  value: LocalCalendarEvent['eventType']
  label: string
  matchTypes: LocalCalendarEvent['eventType'][]
}[] = [
  { value: 'holiday', label: '공휴일', matchTypes: ['holiday'] },
  { value: 'vacation', label: '방학', matchTypes: ['vacation'] },
  { value: 'travel', label: '여행', matchTypes: ['travel'] },
  { value: 'birthday', label: '생일', matchTypes: ['birthday'] },
  { value: 'school', label: '학교', matchTypes: ['school'] },
  { value: 'special', label: '기념일/행사', matchTypes: ['special', 'event'] },
  { value: 'etc', label: '기타', matchTypes: ['etc', 'other'] },
]

/** 범례·일정 시트에서 쓰는 종류 순서 (etc/other·special/event 는 각각 하나) */
const EVENT_TYPES_ORDER: LocalCalendarEvent['eventType'][] = [
  'holiday',
  'vacation',
  'travel',
  'birthday',
  'school',
  'special',
  'etc',
]

type OverrideType = LocalCalendarEvent['routineOverride']

/**
 * 캘린더 목록·상세에 보여 줄 루틴 오버라이드 문구
 * (비개발자: 주중/주말(주간) 휴일 루틴/아예 루틴 없음 중 하나)
 */
function routineOverrideLabel(override: LocalCalendarEvent['routineOverride']): string {
  if (override === 'none') return '루틴 없음'
  if (override === 'weekend') return '주말/휴일 루틴'
  return '주중 루틴'
}

interface Props {
  childId: string | null
  /** 홈 브리핑/다가오는 일정에서 눌러 자동으로 열 날짜(YYYY-MM-DD) */
  focusDate?: string | null
  /** 같은 날짜를 다시 눌러도 상세 팝업이 재오픈되도록 하는 논스(클릭마다 증가) */
  focusNonce?: number
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

export default function CalendarSection({ childId, focusDate = null, focusNonce }: Props) {
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
  /** 이번 달 일정 — 기본 접힘(탭하면 펼침) */
  const [monthScheduleOpen, setMonthScheduleOpen] = useState(false)
  /** 캘린더 뷰 — 홈 기본은 주간(주 단위), 토글로 월간 전환 */
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  /**
   * 상단 범례(유형 칩): null 이면 전체, 값이면 **격자·이번 달 일정 목록**만 해당 유형으로 쌓기.
   * 날짜 **상세 시트**는 `events`에서 그날 전체를 따로 뽑아 범례를 적용하지 않음.
   */
  const [legendFilter, setLegendFilter] = useState<LocalCalendarEvent['eventType'] | null>(null)
  /** `public_holidays` 에서 읽은 법정 공휴일 이름 — 날짜 키(YYYY-MM-DD) → 표시명 */
  const [holidayNamesByDate, setHolidayNamesByDate] = useState<Record<string, string>>({})
  /**
   * 외부 링크로 전달받은 날짜를 "월 이동 후 자동 클릭"하기 위한 대기값입니다.
   * 비개발자 설명: 링크로 열렸을 때 달력 월이 다르면 먼저 월을 맞춘 뒤, 그 날짜를 자동으로 눌러 줍니다.
   */
  const [pendingFocusDate, setPendingFocusDate] = useState<string | null>(null)
  /**
   * `refreshMergedEvents`가 끝날 때마다 1씩 올라갑니다(성공/실패 모두).
   * 브리핑 `calendarDate` 딥링크로 **월만 맞춘 뒤** 곧바로 `handleDayClick`을 열면
   * 아직 `events`가 `[]`인 레이스가 있어, 병합이 반영된 뒤에만 자동 열기 하기 위한 신호로 씁니다.
   */
  const [calendarDataRevision, setCalendarDataRevision] = useState(0)

  /**
   * localStorage + 서버 `calendar_events` 를 합쳐 `events` 를 맞춥니다.
   * 브리핑 링크(`/parent/routine?calendarDate=`)로 들어와도 해당 날짜에 서버 일정이 보이게 합니다.
   */
  const refreshMergedEvents = useCallback(async () => {
    let local: LocalCalendarEvent[] = []
    let server: LocalCalendarEvent[] = []
    let merged: LocalCalendarEvent[] = []
    try {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) local = JSON.parse(raw) as LocalCalendarEvent[]
      } catch {
        local = []
      }
      server = await fetchParentCalendarEventsFromServer(childId)
      merged = dedupeMergedCalendarEventsByTitleAndStart(
        filterOutDeletedCalendarEvents(mergeServerAndLocalCalendar(server, local, childId)),
      )
      /**
       * flushSync 로 events 를 먼저 플러시한 뒤 revision 을 올립니다.
       * 같은 배치에서만 처리되면 pendingFocusDate effect 가 revision===0 에서 계속 막히는 현상을 줄입니다.
       */
      flushSync(() => {
        setEvents(merged)
      })
      setCalendarDataRevision((n) => n + 1)
    } catch {
      flushSync(() => {
        setEvents([])
      })
      setCalendarDataRevision((n) => n + 1)
    }
  }, [childId])

  /**
   * 브리핑 `calendarDate=` 딥링크: **먼저** 해당 월로 이동·pending 날짜를 세팅한 뒤 병합을 돌립니다.
   * 병합 effect 가 위와 순서가 바뀌면 같은 틱에서 년·월이 아직 예전 값일 때 revision 만 올라가는 레이스가 생길 수 있습니다.
   */
  useEffect(() => {
    // 잘못된 쿼리 값은 무시해 앱 동작을 안전하게 유지합니다.
    if (!focusDate || !/^\d{4}-\d{2}-\d{2}$/.test(focusDate)) {
      setPendingFocusDate(null)
      return
    }
    const [y, m] = focusDate.split('-').map(Number)
    if (!y || !m) return
    setPendingFocusDate(focusDate)
    // 대상 월/년으로 먼저 이동해야 해당 날짜를 달력에서 바로 열 수 있습니다.
    setYear(y)
    setMonth(m - 1)
    // focusNonce 를 deps 에 포함해, 같은 날짜를 다시 눌러도(팝업 닫은 뒤) 재오픈됩니다.
  }, [focusDate, focusNonce])

  useEffect(() => {
    void refreshMergedEvents()
  }, [refreshMergedEvents, focusDate])

  /** localStorage 가 바뀌면 서버 일정과 다시 합칩니다(다른 탭·에이전트 동기화 포함). */
  useEffect(() => {
    const onStorage = () => {
      void refreshMergedEvents()
    }
    window.addEventListener(COOANC_CALENDAR_STORAGE_UPDATE_EVENT, onStorage)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(COOANC_CALENDAR_STORAGE_UPDATE_EVENT, onStorage)
      window.removeEventListener('storage', onStorage)
    }
  }, [refreshMergedEvents])

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

  const removeEventById = useCallback(
    (id: string) => {
      if (id.startsWith('__public_holiday__')) return
      void deleteParentCalendarEvent(id)
      saveEvents((prev) => prev.filter((e) => e.id !== id))
    },
    [saveEvents],
  )

  const todayStr = getSeoulDateString()

  /**
   * 이 자녀 탭에 보여 줄 일정인지(다른 자녀 전용 제외).
   * `travel` 은 한 자녀 id로만 저장된 가족 여행이 있어, **항상 보이게** 예외 처리합니다.
   */
  function eventVisibleForSelectedChild(ev: LocalCalendarEvent): boolean {
    if (!childId) return true
    if (!ev.childId || ev.childId === childId) return true
    if (ev.eventType === 'travel') return true
    return false
  }

  /** 범례 필터 — 통합 라벨(special↔event, etc↔other)도 같이 걸러짐 */
  function eventMatchesLegendFilter(ev: LocalCalendarEvent): boolean {
    if (!legendFilter) return true
    if (legendFilter === 'special') return ev.eventType === 'special' || ev.eventType === 'event'
    if (legendFilter === 'etc') return ev.eventType === 'etc' || ev.eventType === 'other'
    return ev.eventType === legendFilter
  }

  /**
   * 이번 달에 걸리는 일정(범례 적용 전).
   */
  const monthEventsAll = events.filter((ev) => {
    if (!eventVisibleForSelectedChild(ev)) return false
    return datesInRange(ev.startDate, ev.endDate).some((d) => {
      const [y, m] = d.split('-').map(Number)
      return y === year && m - 1 === month
    })
  })
  /** 범례가 있으면 격자·이번 달 일정 **목록**에만 해당 유형(통합 칩 포함) */
  const monthEvents = (legendFilter ? monthEventsAll.filter(eventMatchesLegendFilter) : monthEventsAll).sort(
    (a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title),
  )

  /**
   * 날짜 → 일정 배열(격자 도트·칸에 쓰는 맵) — `monthEvents` = 범례 반영본이라 칩을 바꾸면 점이 바뀜.
   * (날짜 **상세**는 이 맵이 아니라 `events`에서 그날 전체를 별도로 씀.)
   */
  const dateEventMap: Record<string, LocalCalendarEvent[]> = {}
  for (const ev of monthEvents) {
    for (const d of datesInRange(ev.startDate, ev.endDate)) {
      if (!dateEventMap[d]) dateEventMap[d] = []
      dateEventMap[d].push(ev)
    }
  }
  /**
   * 법정 공휴일(`public_holidays`)은 **격자**에만 합성 행을 넣고, "여행만" 등 필터일 땐 점이 범례와 맞게 빠질 수 있음(상세에는 DB 이름으로만 여전히 표시 가능).
   * id 는 `__public_holiday__:` 로 시작.
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
  const monthCells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysCount }, (_, i) => i + 1)]
  while (monthCells.length % 7 !== 0) monthCells.push(null)

  /**
   * 주간/월간 뷰 — 홈 캘린더는 기본 주간. 주간은 「오늘」이 든 주(없으면 첫 주)만 한 줄로 보여 줍니다.
   * 이벤트 맵은 현재 월 기준이라, 주가 달을 걸치는 가장자리 날은 이번 달 칸만 일정을 표시합니다.
   */
  const todayDayInMonth =
    todayStr.slice(0, 7) === `${year}-${String(month + 1).padStart(2, '0')}`
      ? Number(todayStr.slice(8, 10))
      : null
  const weekRowStart = (() => {
    if (todayDayInMonth == null) return 0
    const idx = monthCells.findIndex((d) => d === todayDayInMonth)
    return idx < 0 ? 0 : Math.floor(idx / 7) * 7
  })()
  const cells: (number | null)[] =
    viewMode === 'week' ? monthCells.slice(weekRowStart, weekRowStart + 7) : monthCells

  /**
   * 날짜 상세에 쓰는 "사용자+서버" 일정(법정 공휴일 합성 행은 제외).
   * 범례와 무관; `eventVisibleForSelectedChild` + 날짜 겹침.
   */
  function userEventsOverlappingDay(dk: string): LocalCalendarEvent[] {
    return events.filter(
      (ev) => eventVisibleForSelectedChild(ev) && datesInRange(ev.startDate, ev.endDate).includes(dk),
    )
  }

  function handleDayClick(dk: string) {
    const raw = dateEventMap[dk] ?? []
    /** 격자용 맵에서 온 합성 공휴일 — 상세는 아래 `phName` + `userAll`이 기준 */
    const fromMap = raw.find((e) => e.id.startsWith('__public_holiday__:'))
    const phName = holidayNamesByDate[dk]?.trim()
    /** `public_holidays` DB 에 이름이 있으면(노동절 등) 범례와 관계없이 상세에 표시 */
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
    const userAll = userEventsOverlappingDay(dk)
    const byId = new Map(userAll.map((e) => [e.id, e]))
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

  useEffect(() => {
    if (!pendingFocusDate) return
    const toOpen = pendingFocusDate
    const [y, m] = toOpen.split('-').map(Number)
    /** 아직 해당 월 달력으로 안 왔으면 월 이동만 기다림 — 여기서 pending 을 비우지 않음 */
    if (y !== year || m - 1 !== month) return
    /**
     * revision 0 은 한 번도 병합이 안 끝난 상태라 자동 열기 금지.
     * 병합 후 revision≥1 일 때만 handleDayClick → 그 다음에만 pending 초기화.
     */
    if (calendarDataRevision === 0) return
    handleDayClick(toOpen)
    setPendingFocusDate(null)
    // `calendarDataRevision`이 올라간 뒤(병합 flush 후) handleDayClick을 호출해, 빈 `events`로 ‘일정 없음’이 뜨는 레이스를 막습니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toOpen/열기 1회만; handleDayClick·events는 이 시점의 렌더 기준
  }, [pendingFocusDate, year, month, calendarDataRevision])

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
      {/* 제목 옆 주간/월간 토글 · 오른쪽 끝 「일정 등록하기」(다가오는 일정 버튼과 동일 스타일, + 대체) */}
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-gray-800">캘린더</h2>
          <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setViewMode('week')}
              aria-pressed={viewMode === 'week'}
              className={`px-2.5 py-0.5 transition-colors ${viewMode === 'week' ? 'bg-[#4A90E2] text-white' : 'bg-white text-gray-500'}`}
            >
              주간
            </button>
            <button
              type="button"
              onClick={() => setViewMode('month')}
              aria-pressed={viewMode === 'month'}
              className={`px-2.5 py-0.5 transition-colors ${viewMode === 'month' ? 'bg-[#4A90E2] text-white' : 'bg-white text-gray-500'}`}
            >
              월간
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={openAddSheet}
          className="shrink-0 rounded-lg border border-[#4A90E2]/40 bg-[#4A90E2]/10 px-3 py-1.5 text-[11px] font-bold text-[#2563EB] shadow-sm transition active:scale-95 hover:bg-[#4A90E2]/15"
          aria-label="일정 등록하기"
        >
          ＋ 일정 등록하기
        </button>
      </div>

      {/* pb-4: 이번 달 일정 아래·카드 하단 여백을 최소로(요청에 따라 pb-10 → 더 축소). FAB과 겹치면 pb-6 등으로만 살짝 늘리면 됨 */}
      <div className="w-full rounded-2xl bg-white px-4 pt-4 pb-4 shadow-sm">

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
          /** 공휴일 칸 글자는 범례가「전체」또는「공휴일」일 때만 —「여행만」이면 도트와 같이 숨김 */
          const showPublicHolidayCellText = legendFilter == null || legendFilter === 'holiday'
          const publicHolidayName = showPublicHolidayCellText ? holidayNamesByDate[dk] : undefined
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

      {/* 공휴일·방학 등 유형 칩(범례) — 캘린더 격자 아래로 이동 */}
      <div
        className="mb-3 flex snap-x snap-proximity touch-pan-x gap-2 overflow-x-auto overscroll-x-contain pb-0.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label="일정 유형 범례 — 칩을 누르면 달의 점과 아래 이번 달 일정 목록이 해당 유형으로 좁혀짐(날짜 상세는 항상 그날 전체)"
      >
        {EVENT_TYPES_ORDER.map((type) => {
          const selected =
            legendFilter === type ||
            (type === 'special' && legendFilter === 'event') ||
            (type === 'etc' && legendFilter === 'other')
          const chip = selected ? EVENT_LEGEND_CHIP_SELECTED[type] : EVENT_COLORS[type]
          return (
            <button
              key={type}
              type="button"
              role="listitem"
              aria-pressed={selected}
              aria-label={
                selected
                  ? `${EVENT_TYPE_LABELS[type]} 필터 해제, 달과 목록을 전체 유형으로`
                  : `${EVENT_TYPE_LABELS[type]}만 달 점·이번 달 일정에 표시`
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

      {/*
        이번 달 일정: 0건이어도 이 블록은 항상 보임.
        블록 전체(제목·쉐브론·빈 안내 문구)를 누르면 펼침/접힘. 일정 행만 전파를 끊어「상세」만 열림.
      */}
      <div
        className="mt-3 cursor-pointer rounded-lg px-0.5 py-0.5 transition-[background-color] active:bg-gray-100/50"
        onClick={() => setMonthScheduleOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          // 키보드 포커스가 상세 `button`에 있을 때는 행의 기본 동작(상세)에 맡김
          if ((e.target as HTMLElement).closest('button')) return
          e.preventDefault()
          setMonthScheduleOpen((o) => !o)
        }}
        tabIndex={0}
        role="group"
        aria-expanded={monthScheduleOpen}
        aria-label={monthScheduleOpen ? '이번 달 일정, 접기' : '이번 달 일정, 펼치기'}
      >
        <div className="flex min-h-9 items-center justify-between gap-2">
          <p className="text-[11px] font-bold text-gray-400">
            이번 달 일정
            {monthEventsAll.length > 0 ? (
              <span className="ml-1 font-black text-gray-500">({monthEventsAll.length})</span>
            ) : null}
          </p>
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center text-gray-400 transition-transform duration-200 ${
              monthScheduleOpen ? 'rotate-180' : ''
            }`}
            aria-hidden
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
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
                  onClick={(e) => {
                    e.stopPropagation()
                    setDetailEvents([ev])
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left ${EVENT_COLORS[ev.eventType].bg}`}
                >
                  <div className="min-w-0">
                    <p className={`truncate text-xs font-bold ${EVENT_COLORS[ev.eventType].text}`}>{ev.title}</p>
                    <p className="text-[10px] text-gray-500">
                      {ev.startDate} ~ {ev.endDate}
                      &nbsp;·&nbsp;
                      {routineOverrideLabel(ev.routineOverride)}
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
        <CalendarEventSheet
          key={sheet.existing?.id ?? `new-${sheet.startDate}-${sheet.presetType ?? 'p'}`}
          initialStartDate={sheet.startDate}
          initialEndDate={sheet.endDate}
          existing={sheet.existing}
          presetEventType={sheet.presetType}
          childId={childId}
          hideRoutineLink
          onSave={(ev) => {
            saveEvents((prev) =>
              sheet.existing ? prev.map((e) => (e.id === ev.id ? ev : e)) : [...prev, ev],
            )
          }}
          onDelete={
            sheet.existing
              ? (id) => {
                  removeEventById(id)
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
            removeEventById(id)
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

export function CalendarEventSheet({
  initialStartDate,
  initialEndDate,
  existing,
  presetEventType,
  childId,
  hideRoutineLink = false,
  onSave,
  onDelete,
  onClose,
}: {
  initialStartDate: string
  initialEndDate: string
  existing?: LocalCalendarEvent
  presetEventType?: LocalCalendarEvent['eventType']
  childId: string | null
  hideRoutineLink?: boolean
  onSave: (ev: LocalCalendarEvent) => void
  onDelete?: (id: string) => void
  onClose: () => void
}) {
  const router = useRouter()
  const [title, setTitle] = useState(existing?.title ?? '')
  const [startDate, setStart] = useState(existing?.startDate ?? initialStartDate)
  const [endDate, setEnd] = useState(existing?.endDate ?? initialEndDate)
  const [eventType, setType] = useState<LocalCalendarEvent['eventType']>(
    existing?.eventType ?? presetEventType ?? 'holiday',
  )
  const [override, setOverride] = useState<OverrideType>(existing?.routineOverride ?? 'weekend')
  // 구버전 일정(JSON)에는 description 키가 없을 수 있음 → 빈 문자열로 시작
  const [description, setDescription] = useState(existing?.description ?? '')
  /**
   * 저장 성공 후에는 즉시 닫지 않고 완료 액션을 보여 줍니다.
   * - routine 탭 내부에서 쓰일 때는 "캘린더 보러가기" 버튼을 숨길 수 있게 확장할 예정입니다.
   */
  const [savedDone, setSavedDone] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setPanelOpen(true), 10)
    return () => window.clearTimeout(t)
  }, [])

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
    setSavedDone(true)
  }

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby="event-sheet-title">
      {/* 오버레이: 패널 뒤 배경 클릭 시 닫기 */}
      <button type="button" className="absolute inset-0 z-40 bg-black/40" aria-label="닫기" onClick={onClose} />
      {/* 오른쪽 슬라이드 패널: 닫힘=오른쪽 바깥, 열림=제자리 */}
      <div
        className={[
          // 모바일: 하단 시트 / md+: 우측 슬라이드 패널
          'fixed inset-x-0 bottom-0 z-50 h-[min(88dvh,100vh-2rem)] w-full rounded-t-3xl bg-white shadow-xl md:inset-x-auto md:top-0 md:right-0 md:h-full md:max-w-[420px] md:rounded-none',
          'transform transition-transform duration-300 ease-in-out',
          panelOpen
            ? 'translate-y-0 md:translate-y-0 md:translate-x-0'
            : 'translate-y-full md:translate-y-0 md:translate-x-full',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-full flex-col">
          <div className="shrink-0 border-b border-gray-100 px-5 py-4">
            <p id="event-sheet-title" className="text-base font-black text-brand-text">
              {existing ? '일정 편집' : '일정 추가'}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 pt-4">
            {savedDone ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <p className="font-medium text-gray-800">일정이 등록됐어요!</p>
                <div className="flex w-full gap-2">
                  {!hideRoutineLink ? (
                    <button
                      type="button"
                      onClick={() => {
                        router.push('/parent/routine')
                        onClose()
                      }}
                      className="flex-1 rounded-xl border border-blue-200 py-2.5 text-sm font-medium text-blue-600"
                    >
                      캘린더 보러가기
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-medium text-gray-600"
                  >
                    닫기
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-1">
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
                  <div className="flex flex-wrap gap-1.5">
                    {EVENT_TYPE_PICKER_OPTIONS.map((opt) => {
                      const selected = opt.matchTypes.includes(eventType)
                      const colors = EVENT_COLORS[opt.value]
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setType(opt.value)}
                          className={`shrink-0 rounded-lg border-2 px-2.5 py-1.5 text-[11px] font-bold transition-all ${
                            selected
                              ? `border-current ${colors.bg} ${colors.text}`
                              : 'border-gray-200 text-gray-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-xs font-bold text-gray-500">루틴 적용</label>
                  {/* 주중 / 주말(주간) 휴일 루틴 / 루틴 없음 — 가로 3칸(좁은 화면은 줄바꿈) */}
                  <div className="flex flex-wrap gap-2">
                    {(['weekday', 'weekend', 'none'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setOverride(v)}
                        className={`min-w-[30%] flex-1 rounded-xl border-2 py-2 text-xs font-bold transition-all ${
                          override === v ? 'border-brand-blue bg-brand-blue/10 text-brand-blue' : 'border-gray-200 text-gray-400'
                        }`}
                      >
                        {v === 'weekday' ? '주중 루틴' : v === 'weekend' ? '주말/휴일 루틴' : '루틴 없음'}
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
              </>
            )}
          </div>

          {!savedDone ? (
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
          ) : (
            <div className="h-3 shrink-0" />
          )}
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
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setPanelOpen(true), 10)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 z-40 bg-black/40" aria-label="닫기" onClick={onClose} />
      <div
        className={[
          // 모바일: 하단 시트 / md+: 우측 슬라이드 패널
          'fixed inset-x-0 bottom-0 z-50 flex h-[min(85dvh,100vh-2rem)] w-full flex-col rounded-t-3xl bg-white shadow-xl md:inset-x-auto md:top-0 md:right-0 md:h-full md:max-w-[420px] md:rounded-none',
          'transform transition-transform duration-300 ease-in-out',
          panelOpen
            ? 'translate-y-0 md:translate-y-0 md:translate-x-0'
            : 'translate-y-full md:translate-y-0 md:translate-x-full',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-gray-100 px-5 py-4">
          <p className="text-base font-black text-brand-text">일정 안내</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-2 pt-4">
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
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setPanelOpen(true), 10)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 z-40 bg-black/40" aria-label="닫기" onClick={onClose} />
      <div
        className={[
          // 모바일: 하단 시트 / md+: 우측 슬라이드 패널
          'fixed inset-x-0 bottom-0 z-50 flex h-[min(85dvh,100vh-2rem)] w-full flex-col rounded-t-3xl bg-white shadow-xl md:inset-x-auto md:top-0 md:right-0 md:h-full md:max-w-[420px] md:rounded-none',
          'transform transition-transform duration-300 ease-in-out',
          panelOpen
            ? 'translate-y-0 md:translate-y-0 md:translate-x-0'
            : 'translate-y-full md:translate-y-0 md:translate-x-full',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-gray-100 px-5 py-4">
          <p className="text-base font-black text-brand-text">일정 상세</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-2 pt-4">
          {/* 제목은 가운데, +는 오른쪽(캘린더 헤더 +와 같은 스타일·동작) */}
          <div className="relative mb-3 flex min-h-7 items-center justify-center">
            <p className="text-sm font-black text-brand-text">선택한 날짜 일정</p>
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
                  루틴: {routineOverrideLabel(ev.routineOverride)}
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
