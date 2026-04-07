'use client'

/**
 * 부모 앱 — 루틴 관리 탭
 * - 표시: 현재 자녀에만 연결된 미션(linked_child_id 일치)만 목록에 둡니다. 시스템 풀(공용 행)은 「추가」 시트에서만 고릅니다.
 * - 일상 미션은 기상→취침 순으로 정렬하고, 주간/주말 각각 한 카드 안에 오전·오후를 접을 수 있게 두며,
 *   펼친 목록은 스페셜 미션과 같이 가로 슬라이드(칩형 카드)로 표시합니다.
 * - 일상 미션 카드는 이모지·제목·시각만 표시합니다. 활성/비활성은 상단 연필(키워드 시트)에서 한 번에 설정합니다.
 * - 알람은 온보딩·상단 「루틴 알람」에서만 설정해 충돌을 막습니다.
 * - 스페셜 「오늘 하루만」미션은 「일정 추가」→ 보너스 배율 시트에서 저장한 뒤 오늘 일정에 넣습니다.
 * - 매일 스페셜은 「보상 배율」로만 배율을 바꿉니다(카드에 「보상 N배」 문구는 넣지 않음).
 */

import { useState, useEffect, useLayoutEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { useParentStore } from '@/store/parentStore'
import ChildProfileNav, { type ChildTab } from '@/components/parent/ChildProfileNav'
import { CompactChildProfileCard } from '@/components/parent/CompactChildProfileCard'
import CalendarSection from '@/components/parent/CalendarSection'
import RoutineKeywordBuilderSheet from '@/components/parent/RoutineKeywordBuilderSheet'
import SpecialMissionAddSheet from '@/components/parent/SpecialMissionAddSheet'
import SpecialMissionBonusSheet from '@/components/parent/SpecialMissionBonusSheet'
import type { Mission } from '@/types/database'
import { uuidStringsEqual } from '@/lib/normalizeUuid'
import { ROUTINE_HAS_SCHOOL_KEY } from '@/lib/routineAlarmLocalPrefs'
import {
  displaySpecialMissionTitle,
  isRoutineSectionMission,
  isSpecialSectionMission,
} from '@/lib/specialMissionChips'
import { sortMissionsByRoutineFlow } from '@/lib/routineChips'

/** HH:MM → "오전/오후 H:MM" */
function formatTime(t: string | null | undefined): string {
  if (!t) return ''
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const m = mStr ?? '00'
  const period = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${period} ${h12}:${m}`
}

function sortByTime(missions: Mission[]): Mission[] {
  return [...missions].sort((a, b) => {
    if (!a.scheduled_time && !b.scheduled_time) return 0
    if (!a.scheduled_time) return 1
    if (!b.scheduled_time) return -1
    return a.scheduled_time.localeCompare(b.scheduled_time)
  })
}

/**
 * 이미 기상→취침 순으로 정렬된 목록을 오전(morning)·오후(그 외 블록)로 나눕니다.
 * block 이 없으면 scheduled_time 시각(12시 미만=오전)으로 추정합니다.
 */
function splitMissionsAmPm(sortedList: Mission[]): { am: Mission[]; pm: Mission[] } {
  const am: Mission[] = []
  const pm: Mission[] = []
  for (const m of sortedList) {
    if (m.block === 'morning') {
      am.push(m)
    } else if (m.block === 'afternoon' || m.block === 'evening' || m.block === 'bedtime') {
      pm.push(m)
    } else if (m.scheduled_time && /^\d{2}:\d{2}$/.test(m.scheduled_time)) {
      const h = parseInt(m.scheduled_time.slice(0, 2), 10)
      if (h < 12) am.push(m)
      else pm.push(m)
    } else {
      pm.push(m)
    }
  }
  return { am, pm }
}

/** 펼침 시 화살표 위쪽(접기), 접힘 시 아래쪽(펼치기) */
function ChevronToggleIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={`${className ?? ''} h-4 w-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 일상·스페셜 공통: 접기 헤더 아래 가로 슬라이드 카드 영역(동일 여백) */
const SLIDE_SECTION_WITH_CARDS = 'border-t border-gray-100 pt-2 pb-2'

/**
 * 일상 미션용 가로 슬라이드 카드(스페셜 SpecialMissionRow 와 같은 폭·스크롤 패턴)
 */
function RoutineMissionSlideCard({ mission: m }: { mission: Mission }) {
  const timeLabel = formatTime(m.scheduled_time)

  return (
    <div
      className={`flex h-full min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-xl bg-white px-1.5 py-2 text-center shadow-sm ring-1 ${
        m.is_active ? 'ring-gray-200' : 'ring-gray-100 opacity-80'
      }`}
    >
      {/* 아이콘(있으면 DB 값) 또는 제목 첫 글자 — ON/OFF는 키워드 시트에서 */}
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center text-lg font-black leading-none text-gray-600"
        aria-hidden
      >
        {m.icon_emoji?.trim() ? m.icon_emoji : m.title.slice(0, 1)}
      </span>
      <div className="w-full min-w-0 px-0.5">
        <p className="line-clamp-2 text-[11px] font-bold leading-tight text-gray-800">{m.title}</p>
        {timeLabel ? (
          <p className="mt-0.5 text-[9px] font-medium tabular-nums text-gray-500">{timeLabel}</p>
        ) : null}
      </div>
    </div>
  )
}

function renderRoutineMissionStrip(list: Mission[], emptyHint: string) {
  if (list.length === 0) {
    return <p className="px-3 py-3 text-center text-[11px] text-gray-400">{emptyHint}</p>
  }
  return (
    <div className="-mx-1 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
      <ul className="m-0 flex w-max min-w-full list-none snap-x snap-mandatory gap-2 px-2 pb-1 pt-1">
        {list.map((m) => (
          <li key={m.id} className="w-[min(26vw,92px)] shrink-0 snap-start py-px">
            <RoutineMissionSlideCard mission={m} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * 오전·오후를 하나의 흰 카드에 넣고, 스페셜 미션과 같이 접기/펼치기 + 가로 슬라이드 목록으로 둡니다.
 */
function AmPmRoutineBlock({
  am,
  pm,
  openAm,
  openPm,
  onToggleAm,
  onTogglePm,
  emptyAmHint,
  emptyPmHint,
}: {
  am: Mission[]
  pm: Mission[]
  openAm: boolean
  openPm: boolean
  onToggleAm: () => void
  onTogglePm: () => void
  emptyAmHint: string
  emptyPmHint: string
}) {
  return (
    <div className="overflow-x-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggleAm}
        aria-expanded={openAm}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-gray-50"
      >
        <span className="text-xs font-bold text-gray-700">오전</span>
        <ChevronToggleIcon open={openAm} className="text-gray-400" />
      </button>
      {openAm ? (
        <div className={am.length === 0 ? 'border-t border-gray-100' : SLIDE_SECTION_WITH_CARDS}>
          {renderRoutineMissionStrip(am, emptyAmHint)}
        </div>
      ) : null}
      <button
        type="button"
        onClick={onTogglePm}
        aria-expanded={openPm}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-gray-50"
      >
        <span className="text-xs font-bold text-gray-700">오후</span>
        <ChevronToggleIcon open={openPm} className="text-gray-400" />
      </button>
      {openPm ? (
        <div className={pm.length === 0 ? 'border-t border-gray-100' : SLIDE_SECTION_WITH_CARDS}>
          {renderRoutineMissionStrip(pm, emptyPmHint)}
        </div>
      ) : null}
    </div>
  )
}

/**
 * 스페셜 미션 — 매일(daily+special)과 오늘만(event)을 한 흰 카드 안에서 두 구역으로 나눔.
 * 헤더~카드 간격·리스트 안쪽 여백은 두 구역 동일(SLIDE_SECTION_WITH_CARDS).
 * 바깥은 overflow-x-hidden 만 써서 ring/그림자 상단이 overflow-hidden 에 잘리지 않게 함.
 */
/** 스페셜 가로 카드 구역 — 일상 슬라이드보다 위·아래 여백을 줄여 카드가 덜 벌어지게 함 */
const SLIDE_SECTION_SPECIAL = 'border-t border-gray-100 pt-1 pb-1'

function SpecialDailyEventBlock({
  dailyMissions,
  eventMissions,
  openDaily,
  openEvent,
  onToggleDaily,
  onToggleEvent,
  assigningId,
  onStartEventAssignWithBonus,
  onOpenDailyBonusSettings,
}: {
  dailyMissions: Mission[]
  eventMissions: Mission[]
  openDaily: boolean
  openEvent: boolean
  onToggleDaily: () => void
  onToggleEvent: () => void
  assigningId: string | null
  /** 오늘 하루만(event) 「일정 추가」— 보너스 시트를 연 뒤 저장 시 오늘 배정 */
  onStartEventAssignWithBonus: (m: Mission) => void
  /** 매일(daily) 스페셜 — 보너스 배율만 설정(오늘 배정 API는 호출하지 않음) */
  onOpenDailyBonusSettings: (m: Mission) => void
}) {
  const renderHorizontalCards = (list: Mission[], isEventList: boolean) => (
    <div className="-mx-1 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
      <ul className="m-0 flex w-max min-w-full list-none snap-x snap-mandatory gap-2 px-2 pb-0.5 pt-0.5">
        {list.map((m) => (
          <li key={m.id} className="w-[min(26vw,92px)] shrink-0 snap-start py-px">
            <SpecialMissionRow
              mission={m}
              assigning={isEventList && assigningId === m.id}
              onStartEventAssignWithBonus={isEventList ? () => onStartEventAssignWithBonus(m) : undefined}
              onOpenDailyBonusSettings={!isEventList ? () => onOpenDailyBonusSettings(m) : undefined}
            />
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <div className="overflow-x-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggleDaily}
        aria-expanded={openDaily}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-gray-50"
      >
        <span className="text-xs font-bold text-gray-700">매일 일정</span>
        <ChevronToggleIcon open={openDaily} className="text-gray-400" />
      </button>
      {openDaily ? (
        <div className={dailyMissions.length === 0 ? 'border-t border-gray-100' : SLIDE_SECTION_SPECIAL}>
          {dailyMissions.length === 0 ? (
            <p className="px-3 py-3 text-center text-[11px] text-gray-400">매일 스페셜 미션이 없어요</p>
          ) : (
            renderHorizontalCards(dailyMissions, false)
          )}
        </div>
      ) : null}
      <button
        type="button"
        onClick={onToggleEvent}
        aria-expanded={openEvent}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-gray-50"
      >
        <span className="text-xs font-bold text-gray-700">오늘 하루만</span>
        <ChevronToggleIcon open={openEvent} className="text-gray-400" />
      </button>
      {openEvent ? (
        <div className={eventMissions.length === 0 ? 'border-t border-gray-100' : SLIDE_SECTION_SPECIAL}>
          {eventMissions.length === 0 ? (
            <p className="px-3 py-3 text-center text-[11px] text-gray-400">
              이벤트 스페셜이 없어요. 연필에서 추가한 뒤 카드의 「일정 추가」로 오늘만 자녀 화면에 넣을 수
              있어요.
            </p>
          ) : (
            renderHorizontalCards(eventMissions, true)
          )}
        </div>
      ) : null}
    </div>
  )
}

/** 주말/휴일 온보딩 구간은 weekly 로 저장됨 (일상 미션만) */
function isWeekendOrHolidayMission(m: Mission): boolean {
  return m.repeat_type === 'weekly'
}

/** 일상 미션 블록 — event·매일 스페셜 키워드(daily+special)는 스페셜 섹션으로만 갑니다 */
function isRoutineMission(m: Mission): boolean {
  return isRoutineSectionMission(m)
}

/** 스페셜 섹션 — event 템플릿 + 매일 자동 스페셜 키워드 */
function isSpecialMission(m: Mission): boolean {
  return isSpecialSectionMission(m)
}

/** 루틴 탭 프로필 카드(홈과 동일 컴포넌트)용 자녀 한 명 분 */
type RoutineChildProfile = {
  id: string
  name: string
  level: number
  credits: number
  hearts: number
  streakDays: number
  age: number | null
  avatarUrl: string | null
  /** 프로필 institution_type — 'home'이 아니면 등원·하원 칩을 씁니다 */
  institutionType: string | null
  /** 홈 탭과 같은 문구로 카드에 표시 */
  ageGroupLabel: string
  childcareLabel: string | null
}

/** 서버에서 넘긴 오늘(서울) daily_missions — 완료된 미션은 일정 추가·보상 배율 대신 안내 */
type TodayDailyMissionRow = {
  childId: string
  missionTemplateId: string
  isCompleted: boolean
}

type Props = {
  missions: Mission[]
  children: RoutineChildProfile[]
  todayDailyMissions?: TodayDailyMissionRow[]
}

/** 루틴 탭 목록: 이 자녀 전용 행만 (시스템 공용 행은 추가 시트에서만 선택) */
function missionsLinkedToChild(list: Mission[], childId: string | null): Mission[] {
  if (!childId) return []
  return list.filter((m) => uuidStringsEqual(m.linked_child_id, childId))
}

export default function RoutineTab({ missions: initial, children, todayDailyMissions = [] }: Props) {
  const pathname = usePathname()
  const { selectedChildId, setSelectedChildId } = useParentStore()
  /** multiline: 긴 안내(예: API hint) — 줄바꿈·너비·표시 시간 확대 */
  const [toast, setToast] = useState<{
    msg: string
    ok: boolean
    multiline?: boolean
  } | null>(null)
  /** 키워드 칩으로 일상 미션 추가 */
  const [keywordSheetOpen, setKeywordSheetOpen] = useState(false)
  const [specialSheetOpen, setSpecialSheetOpen] = useState(false)
  /** 스페셜 보너스(2·3배) 시트 — 매일 카드의 「보상 배율」·이벤트 카드의 「일정 추가」에서 열림 */
  const [bonusMission, setBonusMission] = useState<Mission | null>(null)
  /** 보너스 시트 저장 직후 이 미션을 오늘 daily_missions 에 넣을 때만 채움(이벤트형 스페셜) */
  const [assignTodayAfterBonusMissionId, setAssignTodayAfterBonusMissionId] = useState<string | null>(null)
  /** 오늘 일정에서 이미 완료된 미션에 보너스·일정 추가 시 */
  const [alreadyCompletedModalOpen, setAlreadyCompletedModalOpen] = useState(false)
  const [assigningId, setAssigningId] = useState<string | null>(null)

  /** 오전/오후 접기 — 기본 접힘 */
  const [openWeekdayAm, setOpenWeekdayAm] = useState(false)
  const [openWeekdayPm, setOpenWeekdayPm] = useState(false)
  const [openWeekendAm, setOpenWeekendAm] = useState(false)
  const [openWeekendPm, setOpenWeekendPm] = useState(false)
  const [openWeekdayInactiveAm, setOpenWeekdayInactiveAm] = useState(false)
  const [openWeekdayInactivePm, setOpenWeekdayInactivePm] = useState(false)
  const [openWeekendInactiveAm, setOpenWeekendInactiveAm] = useState(false)
  const [openWeekendInactivePm, setOpenWeekendInactivePm] = useState(false)
  /** 스페셜: 매일 포함 / 오늘만 넣기 — 일상 오전·오후와 같이 기본 접힘 */
  const [openSpecialDaily, setOpenSpecialDaily] = useState(false)
  const [openSpecialEvent, setOpenSpecialEvent] = useState(false)

  useEffect(() => {
    if (children.length === 0) {
      setSelectedChildId(null)
      return
    }
    const stillThere = selectedChildId && children.some((c) => c.id === selectedChildId)
    if (!stillThere) {
      setSelectedChildId(children[0].id)
    }
  }, [children, selectedChildId, setSelectedChildId])

  const currentId = selectedChildId ?? children[0]?.id ?? null
  const currentChild = children.find((c) => c.id === currentId) ?? children[0]
  const childLevel = currentChild?.level ?? 0
  /** 온보딩과 동일: 집 보육이 아니면 학교·기관 루틴으로 봅니다 */
  const hasSchool =
    Boolean(currentChild?.institutionType && currentChild.institutionType !== 'home')

  /** 상단 알람 시트에서 하원·귀가 행 표시 여부(선택 중인 자녀 기준) */
  useEffect(() => {
    try {
      localStorage.setItem(ROUTINE_HAS_SCHOOL_KEY, hasSchool ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [hasSchool])

  /** 홈의 코칭 카드에서 `#parent-routine-special-missions` 로 올 때 스페셜 미션 블록이 보이도록 스크롤(Next 클라이언트 전환 대응) */
  useEffect(() => {
    if (pathname !== '/parent/routine') return
    const id = 'parent-routine-special-missions'
    if (typeof window === 'undefined' || window.location.hash !== `#${id}`) return
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
    return () => window.clearTimeout(t)
  }, [pathname])

  const tabs: ChildTab[] = children.map((c) => ({ id: c.id, name: c.name }))

  const scopedInitial = useMemo(() => missionsLinkedToChild(initial, currentId), [initial, currentId])
  const [missions, setMissions] = useState<Mission[]>(scopedInitial)
  useEffect(() => {
    setMissions(scopedInitial)
  }, [scopedInitial])

  const routineOnly = useMemo(() => missions.filter(isRoutineMission), [missions])
  const specialOnly = useMemo(() => missions.filter(isSpecialMission), [missions])

  const filteredRoutine = useMemo(
    () => sortMissionsByRoutineFlow(routineOnly.filter((m) => m.level_required <= childLevel)),
    [routineOnly, childLevel],
  )
  const activeRoutine = filteredRoutine.filter((m) => m.is_active)
  const inactiveRoutine = filteredRoutine.filter((m) => !m.is_active)

  const weekdayActive = activeRoutine.filter((m) => !isWeekendOrHolidayMission(m))
  const weekendActive = activeRoutine.filter((m) => isWeekendOrHolidayMission(m))
  const weekdayInactive = inactiveRoutine.filter((m) => !isWeekendOrHolidayMission(m))
  const weekendInactive = inactiveRoutine.filter((m) => isWeekendOrHolidayMission(m))

  const weekdayActiveParts = useMemo(() => splitMissionsAmPm(weekdayActive), [weekdayActive])
  const weekendActiveParts = useMemo(() => splitMissionsAmPm(weekendActive), [weekendActive])
  const weekdayInactiveParts = useMemo(() => splitMissionsAmPm(weekdayInactive), [weekdayInactive])
  const weekendInactiveParts = useMemo(() => splitMissionsAmPm(weekendInactive), [weekendInactive])

  const filteredSpecial = sortByTime(specialOnly.filter((m) => m.level_required <= childLevel))
  const activeSpecial = filteredSpecial.filter((m) => m.is_active)
  const inactiveSpecial = filteredSpecial.filter((m) => !m.is_active)
  /** 활성 먼저·비활성 뒤 — 매일(daily) / 이벤트(event) 로 나눔 */
  const allSpecialOrdered = useMemo(
    () => [...activeSpecial, ...inactiveSpecial],
    [activeSpecial, inactiveSpecial],
  )
  const specialDailyList = useMemo(
    () => allSpecialOrdered.filter((m) => m.repeat_type === 'daily'),
    [allSpecialOrdered],
  )
  const specialEventList = useMemo(
    () => allSpecialOrdered.filter((m) => m.repeat_type === 'event'),
    [allSpecialOrdered],
  )

  const showToast = useCallback((msg: string, ok = true, multiline = false) => {
    setToast({ msg, ok, multiline })
    setTimeout(() => setToast(null), multiline ? 9000 : 2500)
  }, [])

  /** 선택 자녀 기준, 해당 템플릿이 오늘 daily_missions 에 있고 이미 완료됐는지 */
  const isMissionCompletedToday = useCallback(
    (missionTemplateId: string) => {
      if (!currentId) return false
      const row = todayDailyMissions.find(
        (r) => r.childId === currentId && r.missionTemplateId === missionTemplateId,
      )
      return Boolean(row?.isCompleted)
    },
    [currentId, todayDailyMissions],
  )

  /** 스페셜 템플릿을 오늘 daily_missions 한 줄로 넣음 (자녀 앱 즉시 반영) */
  async function handleAssignToday(templateId: string) {
    if (!currentId) return
    setAssigningId(templateId)
    try {
      const res = await fetch('/api/daily-mission/assign-today', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: currentId, missionTemplateId: templateId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const base =
          typeof json.error === 'string' ? json.error : '오늘 일정에 넣지 못했어요'
        const hint = typeof json.hint === 'string' ? json.hint.trim() : ''
        const combined = hint ? `${base}\n\n${hint}` : base
        showToast(combined, false, Boolean(hint))
        return
      }
      showToast(json.alreadyAssigned ? '이미 오늘 일정에 있어요' : '오늘 자녀 화면에 넣었어요')
    } catch {
      showToast('네트워크 오류가 발생했어요', false)
    } finally {
      setAssigningId(null)
    }
  }

  function mergeMission(updated: Mission) {
    setMissions((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
  }

  return (
    <div className="flex flex-col gap-3">
      {toast && (
        <div
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-[60] font-bold text-sm shadow-lg ${
            toast.ok ? 'bg-[#4A90E2] text-white' : 'bg-red-500 text-white'
          } ${
            toast.multiline
              ? 'max-w-[min(92vw,22rem)] whitespace-pre-line px-4 py-3 rounded-2xl text-left leading-snug font-semibold'
              : 'px-5 py-2.5 rounded-full text-center'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* 홈과 동일한 자녀 프로필 카드(미션 달성률 줄 없음) + 다자녀 전환 */}
      {currentChild && (
        <div className="flex flex-col gap-2">
          <CompactChildProfileCard
            name={currentChild.name}
            age={currentChild.age}
            avatarUrl={currentChild.avatarUrl}
            level={childLevel}
            credits={currentChild.credits}
            hearts={currentChild.hearts}
            streakDays={currentChild.streakDays}
            ageGroupLabel={currentChild.ageGroupLabel}
            childcareLabel={currentChild.childcareLabel}
            mission={null}
          />
          <ChildProfileNav tabs={tabs} compact />
        </div>
      )}

      {/* 활성 미션 — 헤더와 연필(키워드 시트) 동일 행 */}
      <section>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-gray-800">일상 미션</h2>
          <button
            type="button"
            aria-label="키워드로 일상 미션 추가·편집"
            disabled={!currentId}
            onClick={() => setKeywordSheetOpen(true)}
            className="shrink-0 rounded-md p-0.5 text-gray-500 transition-opacity hover:text-gray-600 active:opacity-60 disabled:opacity-30"
          >
            {/* 시각 라벨(~9px)과 비슷한 크기의 회색 연필 */}
            <PencilIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        {activeRoutine.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center">
            <button
              type="button"
              disabled={!currentId}
              onClick={() => setKeywordSheetOpen(true)}
              className="text-sm font-bold text-[#4A90E2] underline-offset-2 hover:underline disabled:opacity-30"
            >
              미션 추가하기
            </button>
            <p className="mt-2 text-[11px] text-gray-400">주중·주말 루틴을 칩으로 고르면 매일 그에 맞는 카드가 만들어져요.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* 주중: 오전 / 오후 토글(기본 접힘), 순서는 기상→취침 */}
            <div className="space-y-1.5">
              <p className="px-0.5 text-[11px] font-black text-gray-500">주간</p>
              {weekdayActive.length === 0 ? (
                <p className="rounded-xl border border-gray-100 bg-white py-3 text-center text-[11px] text-gray-400 shadow-sm">
                  주간 미션이 없어요
                </p>
              ) : (
                <AmPmRoutineBlock
                  am={weekdayActiveParts.am}
                  pm={weekdayActiveParts.pm}
                  openAm={openWeekdayAm}
                  openPm={openWeekdayPm}
                  onToggleAm={() => setOpenWeekdayAm((v) => !v)}
                  onTogglePm={() => setOpenWeekdayPm((v) => !v)}
                  emptyAmHint="오전 미션이 없어요"
                  emptyPmHint="오후 미션이 없어요"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <p className="px-0.5 text-[11px] font-black text-gray-500">주말, 휴일</p>
              {weekendActive.length === 0 ? (
                <p className="rounded-xl border border-gray-100 bg-white py-3 text-center text-[11px] text-gray-400 shadow-sm">
                  주말, 휴일 미션이 없어요
                </p>
              ) : (
                <AmPmRoutineBlock
                  am={weekendActiveParts.am}
                  pm={weekendActiveParts.pm}
                  openAm={openWeekendAm}
                  openPm={openWeekendPm}
                  onToggleAm={() => setOpenWeekendAm((v) => !v)}
                  onTogglePm={() => setOpenWeekendPm((v) => !v)}
                  emptyAmHint="오전 미션이 없어요"
                  emptyPmHint="오후 미션이 없어요"
                />
              )}
            </div>
          </div>
        )}
      </section>

      {inactiveRoutine.length > 0 && (
        <section>
          <h2 className="mb-1.5 text-sm font-bold text-gray-400">비활성 미션 (일상)</h2>
          <div className="flex flex-col gap-3 opacity-90">
            <div className="space-y-1.5">
              <p className="px-0.5 text-[11px] font-black text-gray-400">주간</p>
              <AmPmRoutineBlock
                am={weekdayInactiveParts.am}
                pm={weekdayInactiveParts.pm}
                openAm={openWeekdayInactiveAm}
                openPm={openWeekdayInactivePm}
                onToggleAm={() => setOpenWeekdayInactiveAm((v) => !v)}
                onTogglePm={() => setOpenWeekdayInactivePm((v) => !v)}
                emptyAmHint="없음"
                emptyPmHint="없음"
              />
            </div>
            <div className="space-y-1.5">
              <p className="px-0.5 text-[11px] font-black text-gray-400">주말, 휴일</p>
              <AmPmRoutineBlock
                am={weekendInactiveParts.am}
                pm={weekendInactiveParts.pm}
                openAm={openWeekendInactiveAm}
                openPm={openWeekendInactivePm}
                onToggleAm={() => setOpenWeekendInactiveAm((v) => !v)}
                onTogglePm={() => setOpenWeekendInactivePm((v) => !v)}
                emptyAmHint="없음"
                emptyPmHint="없음"
              />
            </div>
          </div>
        </section>
      )}

      {/* 스페셜: 매일 반복하지 않는 미션 — 자녀 앱에서 팝업·카드로 전달 (헤더·빈 상태는 일상 미션과 동일 패턴) */}
      <section id="parent-routine-special-missions">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-gray-800">스페셜 미션</h2>
          {/* 일상 미션과 동일: 연필 아이콘으로 추가·편집 시트 열기 */}
          <button
            type="button"
            aria-label="스페셜 미션 추가·편집"
            disabled={!currentId}
            onClick={() => setSpecialSheetOpen(true)}
            className="shrink-0 rounded-md p-0.5 text-gray-500 transition-opacity hover:text-gray-600 active:opacity-60 disabled:opacity-30"
          >
            <PencilIcon className="h-3.5 w-3.5" />
          </button>
        </div>
        {activeSpecial.length === 0 && inactiveSpecial.length === 0 ? (
          /* 비어 있을 때: 일상 미션 블록과 같은 레이아웃(중앙 제목 버튼 + 회색 안내 문구) */
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center">
            <button
              type="button"
              disabled={!currentId}
              onClick={() => setSpecialSheetOpen(true)}
              className="text-sm font-bold text-[#4A90E2] underline-offset-2 hover:underline disabled:opacity-30"
            >
              스페셜 미션 추가하기
            </button>
            <p className="mt-2 text-[11px] text-gray-400">
              운동하기, 설거지, 빨래 정리 등 특별한 날의 이벤트 미션
            </p>
          </div>
        ) : (
          <SpecialDailyEventBlock
            dailyMissions={specialDailyList}
            eventMissions={specialEventList}
            openDaily={openSpecialDaily}
            openEvent={openSpecialEvent}
            onToggleDaily={() => setOpenSpecialDaily((v) => !v)}
            onToggleEvent={() => setOpenSpecialEvent((v) => !v)}
            assigningId={assigningId}
            onStartEventAssignWithBonus={(m) => {
              if (isMissionCompletedToday(m.id)) {
                setAlreadyCompletedModalOpen(true)
                return
              }
              setAssignTodayAfterBonusMissionId(m.id)
              setBonusMission(m)
            }}
            onOpenDailyBonusSettings={(m) => {
              if (isMissionCompletedToday(m.id)) {
                setAlreadyCompletedModalOpen(true)
                return
              }
              setAssignTodayAfterBonusMissionId(null)
              setBonusMission(m)
            }}
          />
        )}
      </section>

      <CalendarSection childId={currentId ?? null} />

      {/* 키워드 시트: routineOnly로 주간/주말·활성 상태를 목록과 동일한 DB 스냅샷에서 복원 */}
      <RoutineKeywordBuilderSheet
        open={keywordSheetOpen}
        onClose={() => setKeywordSheetOpen(false)}
        linkedChildId={currentId}
        hasSchool={hasSchool}
        routineMissions={routineOnly}
      />

      {/* 스페셜 시트: specialOnly 로 이미 붙어 있는 키워드·데일리 여부를 열 때 복원 */}
      <SpecialMissionAddSheet
        open={specialSheetOpen}
        onClose={() => setSpecialSheetOpen(false)}
        childId={currentId}
        specialMissions={specialOnly}
        onToast={showToast}
      />

      <RoutineSimpleAlertModal
        open={alreadyCompletedModalOpen}
        message="이미 완료된 미션이에요"
        onClose={() => setAlreadyCompletedModalOpen(false)}
      />

      <SpecialMissionBonusSheet
        mission={bonusMission}
        onClose={() => {
          setBonusMission(null)
          setAssignTodayAfterBonusMissionId(null)
        }}
        onSaved={(m) => {
          mergeMission(m)
          const pending = assignTodayAfterBonusMissionId
          if (pending === m.id) {
            setAssignTodayAfterBonusMissionId(null)
            void handleAssignToday(m.id)
          }
        }}
        showToast={showToast}
      />
    </div>
  )
}

/** 섹션 헤더 — 키워드·스페셜 시트 열기용 연필 아이콘 */
function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * 스페셜 미션 카드 — 이모지·제목·(선택) 시각만 표시.
 * - event: 「일정 추가」→ 보너스 시트 후 오늘 넣기
 * - daily: 「보상 배율」만(매일 자동 반영되므로 별도 일정 추가 없음)
 */
function SpecialMissionRow({
  mission: m,
  assigning,
  onStartEventAssignWithBonus,
  onOpenDailyBonusSettings,
}: {
  mission: Mission
  assigning: boolean
  /** 오늘 하루만(event) — 보너스 적용 흐름으로 이어짐 */
  onStartEventAssignWithBonus?: () => void
  /** 매일(daily) 스페셜 — 배율만 편집 */
  onOpenDailyBonusSettings?: () => void
}) {
  const timeLabel = formatTime(m.scheduled_time)
  const titleShort = displaySpecialMissionTitle(m.title)
  return (
    <div
      className={`flex flex-col items-center justify-center gap-0.5 rounded-xl bg-white px-1 py-1 text-center shadow-sm ring-1 ${
        m.is_active ? 'ring-violet-100' : 'ring-gray-100 opacity-80'
      }`}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center text-sm font-black leading-none text-violet-800"
        aria-hidden
      >
        {m.icon_emoji?.trim() ? m.icon_emoji : m.title.slice(0, 1)}
      </span>
      <div className="w-full min-w-0 px-0.5">
        <p className="line-clamp-2 text-[11px] font-bold leading-tight text-gray-800">{titleShort}</p>
        {timeLabel ? <p className="mt-px text-[9px] text-gray-500 tabular-nums">{timeLabel}</p> : null}
      </div>
      <div className="mt-px flex w-full flex-col gap-0.5">
        {m.repeat_type === 'event' && onStartEventAssignWithBonus ? (
          <button
            type="button"
            disabled={!m.is_active || assigning}
            onClick={onStartEventAssignWithBonus}
            className="w-full rounded-md border border-violet-200 bg-violet-50 py-0.5 text-[8px] font-bold leading-tight text-violet-800 disabled:opacity-40"
          >
            {assigning ? '넣는 중…' : '일정 추가'}
          </button>
        ) : null}
        {m.repeat_type !== 'event' && onOpenDailyBonusSettings ? (
          <button
            type="button"
            disabled={!m.is_active}
            onClick={onOpenDailyBonusSettings}
            aria-label="완료 보상 보너스 배율 설정"
            className="w-full rounded-md border border-violet-200/80 bg-violet-50/60 py-0.5 text-[8px] font-bold leading-tight text-violet-900 disabled:opacity-40"
          >
            보상 배율
          </button>
        ) : null}
      </div>
    </div>
  )
}

/** 짧은 안내 한 줄 + 확인 (완료된 미션 등) */
function RoutineSimpleAlertModal({
  open,
  message,
  onClose,
}: {
  open: boolean
  message: string
  onClose: () => void
}) {
  const [portalReady, setPortalReady] = useState(false)
  useLayoutEffect(() => {
    setPortalReady(true)
  }, [])

  if (!open || !portalReady) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="routine-simple-alert-msg"
    >
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="닫기" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[17rem] rounded-2xl bg-white px-4 py-4 shadow-xl">
        <p id="routine-simple-alert-msg" className="text-center text-sm font-black text-gray-900">
          {message}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl bg-[#4A90E2] py-2.5 text-[11px] font-bold text-white"
        >
          확인
        </button>
      </div>
    </div>,
    document.body,
  )
}

