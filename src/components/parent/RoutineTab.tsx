'use client'

/**
 * 부모 앱 — 루틴 관리 탭
 * - 표시: 현재 자녀에만 연결된 미션(linked_child_id 일치)만 목록에 둡니다. 시스템 풀(공용 행)은 「추가」 시트에서만 고릅니다.
 * - 일상·스페셜 가로 칩 줄은 카드 자체를 드래그해 순서를 바꿀 수 있고, DB `missions.sort_order`에
 *   저장되며 자녀 앱 슬라이더 정렬(`compareRoutineFlowSortable`)과 맞춥니다.
 * - 일상 미션은 기상→취침 흐름(블록) 안에서 정렬하며, 주간/주말 각각 한 카드 안에 오전·오후를 접을 수 있게 두며,
 *   펼친 목록은 스페셜 미션과 같이 가로 슬라이드(칩형 카드)로 표시합니다.
 * - 일상 미션 카드는 이모지·제목·시각만 표시합니다. 활성/비활성은 상단 연필(키워드 시트)에서 한 번에 설정합니다.
 * - 알람은 온보딩·상단 「루틴 알람」에서만 설정해 충돌을 막습니다.
 * - 스페셜 「오늘 하루만」미션은 「일정 추가」→ 보너스 배율 시트에서 저장한 뒤 오늘 일정에 넣습니다.
 * - 캘린더는 스페셜 미션처럼 제목·+가 흰 카드 밖에 두고, 우하단 **하단 독바 바로 위**에 작은 원형 파비콘으로 AI 루틴 도우미 패널을 엽니다.
 * - 도우미 창을 닫아도 **대화 내역은 유지**되며, 닫힌 상태에서 AI 분석이 끝나면 플로팅 버튼에 **미읽음 숫자**가 표시됩니다.
 * - 매일 스페셜은 「보상 배율」로만 배율을 바꿉니다(카드에 「보상 N배」 문구는 넣지 않음).
 * - 상단 자녀 프로필 카드에서 캐릭터 좌우 ‹ › 또는 스와이프로 다자녀 전환, 카드 탭 시 「부모가 이 자녀 앱 화면 보기」로 들어갑니다(API 쿠키 후 /home).
 */

import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useSearchParams } from 'next/navigation'
import ParentEnterChildUiLink from '@/components/parent/ParentEnterChildUiLink'
import { CompactChildProfileCard } from '@/components/parent/CompactChildProfileCard'
import { useParentStore } from '@/store/parentStore'
import { useChildSiblingAvatarNav, type ChildTab } from '@/components/parent/ChildProfileNav'
import CalendarSection from '@/components/parent/CalendarSection'
import RoutineKeywordBuilderSheet from '@/components/parent/RoutineKeywordBuilderSheet'
import SpecialMissionAddSheet from '@/components/parent/SpecialMissionAddSheet'
import SpecialMissionBonusSheet from '@/components/parent/SpecialMissionBonusSheet'
import RoutineAgentSchedulePanel from '@/components/parent/RoutineAgentSchedulePanel'
import type { Mission } from '@/types/database'
import { uuidStringsEqual } from '@/lib/normalizeUuid'
import { ROUTINE_HAS_SCHOOL_KEY } from '@/lib/routineAlarmLocalPrefs'
import {
  displaySpecialMissionTitle,
  isRetiredSpecialMissionTitle,
  isRoutineSectionMission,
  isSpecialSectionMission,
} from '@/lib/specialMissionChips'
import {
  dedupeLinkedRoutineMissionsByCanonicalKey,
  isRetiredRoutineMissionTitle,
  sortMissionsByRoutineFlow,
} from '@/lib/routineChips'
import SpriteImage from '@/components/common/SpriteImage'
import { ICONS } from '@/constants/sprites'
import { TOPBAR_LOGO_SRC } from '@/constants/branding'
import { MISSION_ROUTINES_ATLAS } from '@/constants/missionRoutineAtlas'
import { missionRoutineIconFrame } from '@/lib/missionRoutineIconFrame'
import { PARENT_NEUTRAL_CARD_CLASSNAME, PARENT_NEUTRAL_CARD_OVERFLOW_X_CLASSNAME } from '@/lib/parentNeutralBlockStyle'
import { resolveRoutineMissionPngUrl } from '@/lib/routineMissionThumbnail'
import { scaledMissionRewards } from '@/lib/missionRewardMultiplier'
import { MissionRewardIconTriple } from '@/components/mission/MissionRewardIconTriple'
import SortableHorizontalMissionStrip from '@/components/parent/SortableHorizontalMissionStrip'

/**
 * 루틴·스페셜 카드 상단 그림을 그립니다.
 * - `resolveRoutineMissionPngUrl`: **제목**으로 맞는 PNG 를 먼저 고릅니다(DB 에 잘못된 경로가 있어도 덮어씀).
 * - PNG 가 없으면 `routines_01` 아틀라스에서 제목·설명으로 프레임을 고릅니다.
 */
function MissionIconThumb({ mission, size = 36 }: { mission: Mission; size?: number }) {
  const png = resolveRoutineMissionPngUrl({
    title: mission.title,
    iconEmoji: mission.icon_emoji,
    block: mission.block,
  })
  if (png) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- public 정적 경로, 미션 이미지 직접 표시
      <img
        src={png}
        alt=""
        className="h-full w-full object-contain"
        style={{ width: size, height: size }}
        draggable={false}
      />
    )
  }
  const frame = missionRoutineIconFrame(mission.title, mission.description)
  return (
    <SpriteImage
      sheet={MISSION_ROUTINES_ATLAS}
      frame={frame}
      width={size}
      clipRotated={false}
      className="h-full w-full select-none object-contain"
    />
  )
}

/** 자녀 앱 `MissionRewardIconTriple` 과 동일: 배율이 곱해진 `scaledMissionRewards` 를 표시합니다. */
const ROUTINE_CARD_REWARD_ICON_PX = 12

function sortByTime(missions: Mission[]): Mission[] {
  return [...missions].sort((a, b) => {
    const oa = a.sort_order ?? 0
    const ob = b.sort_order ?? 0
    if (oa !== ob) return oa - ob
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
function RoutineMissionSlideCard({ mission: m, onOpenRewardEditor }: { mission: Mission; onOpenRewardEditor: (m: Mission) => void }) {
  return (
    // w-full: li 칸 폭(min(25vw,88px))을 꽉 채워, 카드 옆에 빈 여백이 생기지 않게 함(간격이 넓어 보이는 착시 방지)
    <button
      type="button"
      onClick={() => onOpenRewardEditor(m)}
      aria-label={`${m.title} 보상(크레딧·애정 하트) 수정`}
      className={`flex h-full w-full min-h-[4.25rem] flex-col items-center justify-center gap-1.5 rounded-xl bg-white px-1.5 py-2 text-center shadow-sm ring-1 ${
        m.is_active ? 'ring-gray-200' : 'ring-gray-100 opacity-80'
      }`}
    >
      {/* 아이콘(있으면 DB 값) 또는 제목 첫 글자 — ON/OFF는 키워드 시트에서 */}
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center text-lg font-black leading-none text-gray-600"
        aria-hidden
      >
        <MissionIconThumb mission={m} />
      </span>
      <div className="w-full min-w-0 px-0.5">
        <p className="line-clamp-2 text-[9px] font-bold leading-snug text-gray-800">{m.title}</p>
        {/** 루틴·자녀 오늘의 미션과 동일: 크레딧·애정 하트(카드에는 EXP 별 비표시, 편집 시트에서만 EXP 조정) */}
        <MissionRewardIconTriple
          reward={scaledMissionRewards(m)}
          iconSize={ROUTINE_CARD_REWARD_ICON_PX}
          className={`mt-0.5 flex flex-wrap items-center justify-center gap-x-0.5 gap-y-0.5 text-[9px] font-black text-brand-blue`}
        />
      </div>
    </button>
  )
}

/** 일상·스페셜 미션 설명·빈 목록·오전/오후 캡션·접기 행 보조 문구 — 크기·색 통일(기존 11px 보다 작게) */
const ROUTINE_DESC_TEXT_CLASS = 'text-[10px] font-normal leading-snug text-gray-400'
/** 제목 옆 한 줄 안내(줄임)용 — 위 본문 톤 + truncate */
const ROUTINE_DESC_TRUNCATE_CLASS = `min-w-0 truncate ${ROUTINE_DESC_TEXT_CLASS}`

const ROUTINE_WEEKDAY_AM_CAPTION = '주중 오전 일정을 세팅'
const ROUTINE_WEEKDAY_PM_CAPTION = '주중 오후·저녁·잠자리까지 한 줄로 세팅'
const ROUTINE_WEEKEND_AM_CAPTION = '주말／공휴일 오전 일정을 세팅'
const ROUTINE_WEEKEND_PM_CAPTION = '주말／공휴일 오후·저녁·잠자리까지 한 줄로 세팅'

/**
 * 일상 미션 가로 줄 — 카드 자체를 드래그해 순서를 바꾸면 `/api/mission/reorder` 로 저장됩니다.
 */
function RoutineMissionSortableStrip({
  list,
  emptyHint,
  childId,
  onOpenRewardEditor,
  onReorderError,
}: {
  list: Mission[]
  emptyHint: string
  childId: string | null
  onOpenRewardEditor: (m: Mission) => void
  onReorderError: (msg: string) => void
}) {
  return (
    <SortableHorizontalMissionStrip
      childId={childId}
      missions={list}
      emptyHint={emptyHint}
      onReorderError={onReorderError}
      renderCard={(m, dragHandle) => (
        <div className="relative flex h-full min-h-[4.25rem] w-full flex-col">
          {dragHandle ? (
            <div className="pointer-events-auto absolute -top-0.5 left-1/2 z-[2] -translate-x-1/2">{dragHandle}</div>
          ) : null}
          <RoutineMissionSlideCard mission={m} onOpenRewardEditor={onOpenRewardEditor} />
        </div>
      )}
    />
  )
}

/**
 * 오전·오후를 하나의 흰 카드에 넣고, 접기/펼치기 + 가로 슬라이드 목록으로 둡니다.
 * (시간대별 색 그림자는 자녀 앱 오늘의 미션 카드에만 적용합니다.)
 * - `amCaption` / `pmCaption`: 라벨 옆 한 줄 안내(`ROUTINE_DESC_TEXT_CLASS` 와 동일)
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
  onOpenRewardEditor,
  amCaption,
  pmCaption,
  childId,
  onReorderError,
}: {
  am: Mission[]
  pm: Mission[]
  openAm: boolean
  openPm: boolean
  onToggleAm: () => void
  onTogglePm: () => void
  emptyAmHint: string
  emptyPmHint: string
  onOpenRewardEditor: (m: Mission) => void
  /** 오전 토글 줄 오른쪽(오전 라벨 옆) 안내 문구 — 없으면 라벨만 */
  amCaption?: string
  /** 오후 토글 줄 오른쪽 안내 문구 */
  pmCaption?: string
  /** 순서 저장 시 대상 자녀 — 없으면 드래그 비활성 */
  childId: string | null
  onReorderError: (msg: string) => void
}) {
  return (
    <div className={PARENT_NEUTRAL_CARD_OVERFLOW_X_CLASSNAME}>
      <button
        type="button"
        onClick={onToggleAm}
        aria-expanded={openAm}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-gray-50"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-xs font-bold text-gray-700">오전</span>
          {amCaption ? <span className={`min-w-0 ${ROUTINE_DESC_TEXT_CLASS}`}>{amCaption}</span> : null}
        </span>
        <ChevronToggleIcon open={openAm} className="shrink-0 text-gray-400" />
      </button>
      {openAm ? (
        <div className={am.length === 0 ? 'border-t border-gray-100' : SLIDE_SECTION_WITH_CARDS}>
          <RoutineMissionSortableStrip
            list={am}
            emptyHint={emptyAmHint}
            childId={childId}
            onOpenRewardEditor={onOpenRewardEditor}
            onReorderError={onReorderError}
          />
        </div>
      ) : null}
      <button
        type="button"
        onClick={onTogglePm}
        aria-expanded={openPm}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-gray-50"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-xs font-bold text-gray-700">오후·저녁</span>
          {pmCaption ? <span className={`min-w-0 ${ROUTINE_DESC_TEXT_CLASS}`}>{pmCaption}</span> : null}
        </span>
        <ChevronToggleIcon open={openPm} className="shrink-0 text-gray-400" />
      </button>
      {openPm ? (
        <div className={pm.length === 0 ? 'border-t border-gray-100' : SLIDE_SECTION_WITH_CARDS}>
          <RoutineMissionSortableStrip
            list={pm}
            emptyHint={emptyPmHint}
            childId={childId}
            onOpenRewardEditor={onOpenRewardEditor}
            onReorderError={onReorderError}
          />
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
  onOpenRewardEditor,
  childId,
  onReorderError,
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
  /** 카드 탭으로 보상(크레딧·애정 하트·EXP) 편집 팝업을 엽니다. */
  onOpenRewardEditor: (m: Mission) => void
  childId: string | null
  onReorderError: (msg: string) => void
}) {
  const renderHorizontalCards = (list: Mission[], isEventList: boolean) => (
    <SortableHorizontalMissionStrip
      childId={childId}
      missions={list}
      emptyHint="없음"
      onReorderError={onReorderError}
      renderCard={(m, dragHandle) => (
        <div className="relative flex min-h-[5.5rem] w-full flex-col">
          {dragHandle ? (
            <div className="pointer-events-auto absolute -top-0.5 left-1/2 z-[2] -translate-x-1/2">{dragHandle}</div>
          ) : null}
          <SpecialMissionRow
            mission={m}
            assigning={isEventList && assigningId === m.id}
            onOpenRewardEditor={() => onOpenRewardEditor(m)}
            onStartEventAssignWithBonus={isEventList ? () => onStartEventAssignWithBonus(m) : undefined}
            onOpenDailyBonusSettings={!isEventList ? () => onOpenDailyBonusSettings(m) : undefined}
          />
        </div>
      )}
    />
  )

  return (
    <div className={PARENT_NEUTRAL_CARD_OVERFLOW_X_CLASSNAME}>
      <button
        type="button"
        onClick={onToggleDaily}
        aria-expanded={openDaily}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-gray-50"
      >
        {/* 제목 옆 보조 안내 문구를 작은 회색 글씨로 함께 표시 */}
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-xs font-bold text-gray-700">매일 일정</span>
          <span className={ROUTINE_DESC_TRUNCATE_CLASS}>매일 스페셜 일정으로 추가 완료</span>
        </div>
        <ChevronToggleIcon open={openDaily} className="text-gray-400" />
      </button>
      {openDaily ? (
        <div className={dailyMissions.length === 0 ? 'border-t border-gray-100' : SLIDE_SECTION_SPECIAL}>
          {dailyMissions.length === 0 ? (
            <p className={`px-3 py-3 text-center ${ROUTINE_DESC_TEXT_CLASS}`}>매일 스페셜 미션이 없어요</p>
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
        {/* 오늘 하루만 블록은 일정 추가 행동을 유도하는 안내 문구를 함께 표시 */}
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-xs font-bold text-gray-700">오늘 하루</span>
          <span className={ROUTINE_DESC_TRUNCATE_CLASS}>일정 추가를 눌러 오늘의 미션으로 추가</span>
        </div>
        <ChevronToggleIcon open={openEvent} className="text-gray-400" />
      </button>
      {openEvent ? (
        <div className={eventMissions.length === 0 ? 'border-t border-gray-100' : SLIDE_SECTION_SPECIAL}>
          {eventMissions.length === 0 ? (
            <p className={`px-3 py-3 text-center ${ROUTINE_DESC_TEXT_CLASS}`}>
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
  /** 자녀 id → family_links.id (에이전트 B 일정 등록에 사용) */
  familyLinkByChild?: Record<string, string>
}

/** 루틴 탭 목록: 이 자녀 전용 행만 (시스템 공용 행은 추가 시트에서만 선택) */
function missionsLinkedToChild(list: Mission[], childId: string | null): Mission[] {
  if (!childId) return []
  return list.filter((m) => uuidStringsEqual(m.linked_child_id, childId))
}

export default function RoutineTab({
  missions: initial,
  children,
  todayDailyMissions = [],
  familyLinkByChild = {},
}: Props) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
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
  /** 카드 클릭 시 열리는 보상(크레딧·애정 하트·EXP) 편집 팝업 대상 미션 */
  const [rewardEditMission, setRewardEditMission] = useState<Mission | null>(null)

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
  /** 홈 일정 브리핑에서 넘어온 `calendarDate(YYYY-MM-DD)`를 캘린더 섹션으로 전달합니다. */
  const calendarDateFromQuery = searchParams.get('calendarDate')
  const currentChild = children.find((c) => c.id === currentId) ?? children[0]
  const childLevel = currentChild?.level ?? 0
  const familyLinkId = currentId ? familyLinkByChild[currentId] ?? null : null

  /** AI 일정 패널(오른쪽 슬라이드) 열림 여부 */
  const [schedulePanelOpen, setSchedulePanelOpen] = useState(false)
  /** 패널이 닫혀 있는 동안 도우미(AI) 답장이 쌓인 개수 — 플로팅 버튼 배지 */
  const [routineAgentUnread, setRoutineAgentUnread] = useState(0)

  /** 다른 자녀로 바꾸면 이전 아이 기준 미읽음은 의미가 없어 0으로 돌립니다 */
  useEffect(() => {
    setRoutineAgentUnread(0)
  }, [currentId])

  /** 긴급 최적화: 루틴 탭에서는 Realtime 채널을 열지 않고 API 응답만으로 상태를 갱신합니다. */

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
  const siblingNav = useChildSiblingAvatarNav(tabs)

  const scopedInitial = useMemo(() => missionsLinkedToChild(initial, currentId), [initial, currentId])
  const [missions, setMissions] = useState<Mission[]>(scopedInitial)
  useEffect(() => {
    setMissions(scopedInitial)
  }, [scopedInitial])

  const routineOnly = useMemo(
    () =>
      missions
        .filter(isRoutineMission)
        // 폐지된 일상 키워드(예: 간식먹기)는 부모 루틴 카드에서도 숨깁니다.
        .filter((m) => !isRetiredRoutineMissionTitle(m.title)),
    [missions],
  )
  /** 폐지된 스페셜 키워드(설거지·방청소·심부름 등)는 DB 에 남아 있어도 목록에서 제외 — `051` 마이그레이션으로 행 삭제 권장 */
  const specialOnly = useMemo(
    () => missions.filter(isSpecialMission).filter((m) => !isRetiredSpecialMissionTitle(m.title)),
    [missions],
  )

  const filteredRoutine = useMemo(
    () =>
      dedupeLinkedRoutineMissionsByCanonicalKey(
        sortMissionsByRoutineFlow(routineOnly.filter((m) => m.level_required <= childLevel)),
      ),
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

  async function handleSaveMissionRewards(missionId: string, credit: number, heart: number, exp: number) {
    const res = await fetch('/api/mission/patch-rewards', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ missionId, credit_reward: credit, heart_reward: heart, exp_reward: exp }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(typeof json.error === 'string' ? json.error : '보상 저장에 실패했어요')
    }
    const mission = json.mission as Mission | undefined
    if (!mission) throw new Error('저장된 미션 정보를 읽지 못했어요')
    mergeMission(mission)
    showToast('보상을 저장했어요')
  }

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-4 flex flex-col gap-3 md:gap-6">
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

      {/**
       * 루틴 도우미(챗봇) FAB
       * - 모바일: 독바 바로 위 (bottom = 독높이 + safe-area + 10px)
       * - md+: 하단 우측 고정 (bottom-6)
       */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom,0px)+10px)] z-[55] flex justify-center md:bottom-6">
        {/**
         * pointer-events-none 을 래퍼 div에도 유지합니다.
         * 이전에는 routine-fab-cloud div에 pointer-events-auto 를 두어
         * 버튼 주변 빈 영역(w-full 전체 너비)이 클릭 이벤트를 가로챘습니다.
         * 그로 인해 하단 콘텐츠(예: 「매일 일정」 토글 버튼)가 이 영역과 겹칠 때
         * 탭해도 반응하지 않는 문제가 발생했습니다.
         * pointer-events-auto 를 버튼 자체에만 적용해 빈 공간은 click-through 되도록 합니다.
         */}
        <div className="routine-fab-cloud pointer-events-none flex w-full max-w-md justify-end px-4 md:max-w-none md:px-8">
          <button
            type="button"
            disabled={!currentId}
            onClick={() => setSchedulePanelOpen(true)}
            aria-label={
              routineAgentUnread > 0
                ? `루틴 도우미, 새 답장 ${routineAgentUnread}개. 열어서 확인하기`
                : '루틴 도우미 챗봇 열기'
            }
            className="pointer-events-auto relative flex h-12 w-12 shrink-0 items-center justify-center overflow-visible rounded-full border border-sky-100/90 bg-white shadow-[0_10px_28px_-6px_rgba(59,130,246,0.35),0_4px_14px_-4px_rgba(15,23,42,0.12)] transition active:scale-[0.94] disabled:pointer-events-none disabled:opacity-40"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- 작은 브랜드 마크 */}
            <img src={TOPBAR_LOGO_SRC} alt="" className="h-8 w-8 object-contain" />
            {routineAgentUnread > 0 ? (
              <span
                className="absolute -right-0.5 -top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black tabular-nums leading-none text-white shadow ring-2 ring-white"
                aria-hidden
              >
                {routineAgentUnread > 99 ? '99+' : routineAgentUnread}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      <RoutineAgentSchedulePanel
        open={schedulePanelOpen}
        onClose={() => setSchedulePanelOpen(false)}
        familyLinkId={familyLinkId}
        childId={currentId}
        routineMissions={routineOnly}
        specialMissions={specialOnly}
        hasSchool={hasSchool}
        onToast={showToast}
        onAssistantRepliesWhileClosed={(delta) =>
          setRoutineAgentUnread((n) => {
            const next = n + delta
            return next > 999 ? 999 : next
          })
        }
        onPanelOpened={() => setRoutineAgentUnread(0)}
      />

      {/* ── 2컬럼 그리드 ────────────────────────────────────────────────────────
          모바일(grid-cols-1): 미션 → 캘린더 순(DOM 순서 = 화면 순서)
          md+(grid-cols-2): 좌=미션, 우=CalendarSection(sticky)
      ──────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6 md:items-start">

        {/* 좌 컬럼(md) / 상단(모바일): 프로필 바 + 미션 섹션들 */}
        <div className="flex flex-col gap-3">

          {/* 통합 프로필 바 — 아바타+이름 좌 / 코인·하트·연속 우 */}
          {currentChild && (
            <ParentEnterChildUiLink
              childId={currentChild.id}
              className="block w-full cursor-pointer rounded-2xl transition-opacity active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
              aria-label={`${currentChild.name} 자녀용 앱 화면으로 들어가기`}
              onClick={() => setSelectedChildId(currentChild.id)}
            >
              {/** 설정 탭과 동일한 왼쪽 프로필 정보 레이아웃 + 오른쪽 통계 영역을 공통 카드로 통일 */}
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
                siblingNav={siblingNav}
                avatarEnterShortcut
              />
            </ParentEnterChildUiLink>
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
                <p className={`mt-2 ${ROUTINE_DESC_TEXT_CLASS}`}>주중·주말 루틴을 칩으로 고르면 매일 그에 맞는 카드가 만들어져요.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="space-y-1.5">
                  <p className="px-0.5 text-[11px] font-normal text-gray-400">주간</p>
                  {weekdayActive.length === 0 ? (
                    <p className={`${PARENT_NEUTRAL_CARD_CLASSNAME} py-3 text-center ${ROUTINE_DESC_TEXT_CLASS}`}>
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
                      emptyPmHint="오후·저녁 미션이 없어요"
                      onOpenRewardEditor={setRewardEditMission}
                      amCaption={ROUTINE_WEEKDAY_AM_CAPTION}
                      pmCaption={ROUTINE_WEEKDAY_PM_CAPTION}
                      childId={currentId}
                      onReorderError={(msg) => showToast(msg, false)}
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <p className="px-0.5 text-[11px] font-normal text-gray-400">주말, 휴일</p>
                  {weekendActive.length === 0 ? (
                    <p className={`${PARENT_NEUTRAL_CARD_CLASSNAME} py-3 text-center ${ROUTINE_DESC_TEXT_CLASS}`}>
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
                      emptyPmHint="오후·저녁 미션이 없어요"
                      onOpenRewardEditor={setRewardEditMission}
                      amCaption={ROUTINE_WEEKEND_AM_CAPTION}
                      pmCaption={ROUTINE_WEEKEND_PM_CAPTION}
                      childId={currentId}
                      onReorderError={(msg) => showToast(msg, false)}
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
                  <p className="px-0.5 text-[11px] font-normal text-gray-300">주간</p>
                  <AmPmRoutineBlock
                    am={weekdayInactiveParts.am}
                    pm={weekdayInactiveParts.pm}
                    openAm={openWeekdayInactiveAm}
                    openPm={openWeekdayInactivePm}
                    onToggleAm={() => setOpenWeekdayInactiveAm((v) => !v)}
                    onTogglePm={() => setOpenWeekdayInactivePm((v) => !v)}
                    emptyAmHint="없음"
                    emptyPmHint="없음"
                    onOpenRewardEditor={setRewardEditMission}
                    amCaption={ROUTINE_WEEKDAY_AM_CAPTION}
                    pmCaption={ROUTINE_WEEKDAY_PM_CAPTION}
                    childId={currentId}
                    onReorderError={(msg) => showToast(msg, false)}
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="px-0.5 text-[11px] font-normal text-gray-300">주말, 휴일</p>
                  <AmPmRoutineBlock
                    am={weekendInactiveParts.am}
                    pm={weekendInactiveParts.pm}
                    openAm={openWeekendInactiveAm}
                    openPm={openWeekendInactivePm}
                    onToggleAm={() => setOpenWeekendInactiveAm((v) => !v)}
                    onTogglePm={() => setOpenWeekendInactivePm((v) => !v)}
                    emptyAmHint="없음"
                    emptyPmHint="없음"
                    onOpenRewardEditor={setRewardEditMission}
                    amCaption={ROUTINE_WEEKEND_AM_CAPTION}
                    pmCaption={ROUTINE_WEEKEND_PM_CAPTION}
                    childId={currentId}
                    onReorderError={(msg) => showToast(msg, false)}
                  />
                </div>
              </div>
            </section>
          )}

          {/* 스페셜: 매일 반복하지 않는 미션 */}
          <section id="parent-routine-special-missions" className="mt-2">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-gray-800">스페셜 미션</h2>
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
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center">
                <button
                  type="button"
                  disabled={!currentId}
                  onClick={() => setSpecialSheetOpen(true)}
                  className="text-sm font-bold text-[#4A90E2] underline-offset-2 hover:underline disabled:opacity-30"
                >
                  스페셜 미션 추가하기
                </button>
                <p className={`mt-2 ${ROUTINE_DESC_TEXT_CLASS}`}>
                  운동하기, 야채먹기, 외투 걸어두기 등 특별한 날의 이벤트 미션
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
                onOpenRewardEditor={setRewardEditMission}
                childId={currentId}
                onReorderError={(msg) => showToast(msg, false)}
              />
            )}
          </section>

        </div>{/* /좌 컬럼 */}

        {/* 우 컬럼(md) / 하단(모바일): CalendarSection — sticky on md */}
        <div className="md:sticky md:top-4">
          <CalendarSection childId={currentId ?? null} focusDate={calendarDateFromQuery} />
        </div>

      </div>{/* /2컬럼 그리드 */}

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

      <MissionRewardEditModal
        mission={rewardEditMission}
        onClose={() => setRewardEditMission(null)}
        onSave={handleSaveMissionRewards}
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
 * 스페셜 미션 카드 — 썸네일·제목·보상·하단 액션 버튼.
 * - event: 「일정 추가」→ 보너스 시트 후 오늘 넣기
 * - daily: 「보상 배율」만(매일 자동 반영되므로 별도 일정 추가 없음)
 */
function SpecialMissionRow({
  mission: m,
  assigning,
  onOpenRewardEditor,
  onStartEventAssignWithBonus,
  onOpenDailyBonusSettings,
}: {
  mission: Mission
  assigning: boolean
  /** 카드 탭 시 보상 편집 팝업 열기 */
  onOpenRewardEditor: () => void
  /** 오늘 하루만(event) — 보너스 적용 흐름으로 이어짐 */
  onStartEventAssignWithBonus?: () => void
  /** 매일(daily) 스페셜 — 배율만 편집 */
  onOpenDailyBonusSettings?: () => void
}) {
  const titleShort = displaySpecialMissionTitle(m.title)
  return (
    // w-full: 일상 슬라이드와 같이 li 폭을 채워 카드 사이 간격만 gap 으로 보이게 함
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenRewardEditor}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpenRewardEditor()
        }
      }}
      aria-label={`${m.title} 보상(크레딧·애정 하트) 수정`}
      className={`flex min-h-[5.5rem] w-full flex-col items-center justify-center gap-1.5 rounded-xl bg-white px-1 py-1 text-center shadow-sm ring-1 ${
        m.is_active ? 'ring-violet-100' : 'ring-gray-100 opacity-80'
      }`}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center text-sm font-black leading-none text-violet-800"
        aria-hidden
      >
        <MissionIconThumb mission={m} />
      </span>
      <div className="w-full min-w-0 px-0.5">
        <p className="line-clamp-2 text-[9px] font-bold leading-snug text-gray-800">{titleShort}</p>
        <MissionRewardIconTriple
          reward={scaledMissionRewards(m)}
          iconSize={ROUTINE_CARD_REWARD_ICON_PX}
          className="mt-px flex flex-wrap items-center justify-center gap-x-0.5 gap-y-0.5 text-[9px] font-black text-violet-700"
        />
      </div>
      <div className="mt-px flex w-full flex-col gap-0.5">
        {m.repeat_type === 'event' && onStartEventAssignWithBonus ? (
          <button
            type="button"
            disabled={!m.is_active || assigning}
            onClick={(e) => {
              e.stopPropagation()
              onStartEventAssignWithBonus()
            }}
            className="w-full rounded-md border border-violet-200 bg-violet-50 py-0.5 text-[8px] font-bold leading-tight text-violet-800 disabled:opacity-40"
          >
            {assigning ? '넣는 중…' : '일정 추가'}
          </button>
        ) : null}
        {m.repeat_type !== 'event' && onOpenDailyBonusSettings ? (
          <button
            type="button"
            disabled={!m.is_active}
            onClick={(e) => {
              e.stopPropagation()
              onOpenDailyBonusSettings()
            }}
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

function MissionRewardEditModal({
  mission,
  onClose,
  onSave,
}: {
  mission: Mission | null
  onClose: () => void
  onSave: (missionId: string, credit: number, heart: number, exp: number) => Promise<void>
}) {
  const [portalReady, setPortalReady] = useState(false)
  const [credit, setCredit] = useState('0')
  const [heart, setHeart] = useState('0')
  const [exp, setExp] = useState('0')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useLayoutEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    if (!mission) return
    setCredit(String(Math.max(0, mission.credit_reward)))
    setHeart(String(Math.max(0, mission.heart_reward)))
    setExp(String(Math.max(0, mission.exp_reward)))
    setErr(null)
    setBusy(false)
  }, [mission])

  if (!mission || !portalReady) return null

  const parsedCredit = Math.max(0, Math.floor(Number(credit) || 0))
  const parsedHeart = Math.max(0, Math.floor(Number(heart) || 0))
  const parsedExp = Math.max(0, Math.floor(Number(exp) || 0))

  async function submit() {
    setBusy(true)
    setErr(null)
    try {
      await onSave(mission.id, parsedCredit, parsedHeart, parsedExp)
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장에 실패했어요')
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="닫기" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
        <p className="text-center text-sm font-black text-gray-900">보상 수정</p>
        <p className="mt-1 text-center text-xs font-semibold text-gray-600">{mission.title}</p>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-[11px] font-bold text-gray-600">
            크레딧
            <input
              type="number"
              min={0}
              step={1}
              value={credit}
              onChange={(e) => setCredit(e.target.value)}
              className="rounded-lg border border-gray-200 px-2 py-2 text-sm font-black tabular-nums text-sky-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold text-gray-600">
            하트
            <input
              type="number"
              min={0}
              step={1}
              value={heart}
              onChange={(e) => setHeart(e.target.value)}
              className="rounded-lg border border-gray-200 px-2 py-2 text-sm font-black tabular-nums text-rose-600"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold text-gray-600">
            경험치(EXP)
            <input
              type="number"
              min={0}
              step={1}
              value={exp}
              onChange={(e) => setExp(e.target.value)}
              className="rounded-lg border border-gray-200 px-2 py-2 text-sm font-black tabular-nums text-violet-900"
            />
          </label>
        </div>

        {err ? <p className="mt-2 text-center text-[11px] font-bold text-red-600">{err}</p> : null}

        <div className="mt-3 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-gray-100 py-2 text-sm font-bold text-gray-600">
            취소
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="flex-1 rounded-xl bg-[#4A90E2] py-2 text-sm font-black text-white disabled:opacity-50"
          >
            {busy ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

