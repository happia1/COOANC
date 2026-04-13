'use client'

/**
 * 루틴 탭 — 우측 하단에서 열리는 「챗봇」슬라이딩 패널입니다.
 * - Framer Motion 으로 오른쪽에서 패널이 들어옵니다. 패널·대화 스크롤 영역 배경은 흰색으로 통일합니다.
 * - 상단 인텐트 UI: 대분류·세부 칩 모두 가로 스크롤(막대 숨김) + 우측 페이드(`globals.css` 의 `.routine-agent-intent-scroll-fade`). 세부 칩은 카테고리 탭을 눌렀을 때만 보입니다(같은 탭 재클릭 시 접힘).
 * - 가로·세로 스크롤 **막대(슬라이드 바)** 는 `globals.css` 의 `.routine-agent-hide-scrollbar` 로 숨기되, 스크롤 동작은 그대로 둡니다.
 * - 부모 탭 `<main>` 이 스크롤 컨테이너라 막대가 오버레이 위에 겹칠 수 있어, 열릴 때 `overflow` 를 잠그고 z-index 를 시트들보다 높입니다.
 * - 텍스트·이미지·직접 입력은 `/agent-b/parse` 로 보냅니다. 한 건만 나오면 곧바로 DB 초안 + 제안이 붙고, 여러 건이면 `< 1/N >` 로 한 줄씩 확인한 뒤 [등록] 시 `/agent-b/commit-schedule` 로 저장합니다.
 * - 패널을 **닫아도 대화 말풍선은 지우지 않습니다**(자녀·가족 연결만 바뀔 때 새로 시작). 닫힌 뒤 분석이 끝나면 부모 탭이 플로팅 배지 숫자를 올립니다.
 * - 제안(routine_off 등)은 **한 장의 파스텔 카드**로 묶고, `special_mission`·`extra_reward` 는 화면에 숨긴 뒤 [등록하기] 때 서버에만 승인 요청합니다.
 * - 이미지는 브라우저에서 JPEG 로 줄여 보내 MIME 불일치·용량 초과 오류를 줄입니다.
 */

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  postAgentApprove,
  postAgentCommitSchedule,
  postAgentParse,
  type AgentParseApiRow,
  type AgentParseEvent,
  type AgentParseResponse,
  type AgentParsedScheduleRow,
  type AgentParseSuggestion,
} from '@/lib/agentApi'
import { getSeoulDateString } from '@/lib/koreaDate'
import { TOPBAR_LOGO_SRC } from '@/constants/branding'
import { PARENT_TABS_MAIN_SCROLL_EL_ID } from '@/lib/parentTabsMainScrollId'
import type { LocalCalendarEvent } from '@/types/database'
import { COOANC_CALENDAR_EVENTS_STORAGE_KEY } from '@/lib/localStorageChildScope'
import {
  RoutineAgentDateSlotPicker,
  RoutineAgentPickerPresence,
  RoutineAgentTypeSlotPicker,
} from '@/components/parent/RoutineAgentScheduleSlotPickers'
import {
  SCHEDULE_TYPE_PICKER_OPTIONS,
  agentTypeToLocalCalendarType,
  agentTypeToPickerLabel,
  buildAgentParseResponseFromLocal,
  buildScheduleFromText,
  normalizeAgentTypeForPicker,
  shouldCallAPI,
} from '@/lib/routineAgentLocalParse'
import {
  patchLocalCalendarEventInStorage,
  shouldSkipSyncAgentEvent,
  syncAgentEventToLocalCalendar,
} from '@/lib/syncAgentEventToLocalCalendar'

type Props = {
  open: boolean
  onClose: () => void
  familyLinkId: string | null
  childId: string | null
  onToast: (msg: string, ok?: boolean, multiline?: boolean) => void
  /**
   * 패널이 닫혀 있는 동안 AI 분석(parse)·다건 일정 커밋 등 **새 답장**이 도착했을 때만 호출됩니다.
   * 부모 탭에서 플로팅 버튼 배지 숫자를 올릴 때 씁니다.
   */
  onAssistantRepliesWhileClosed?: (count: number) => void
  /** 패널이 열릴 때마다 호출 — 미읽음 배지를 0으로 돌릴 때 사용합니다 */
  onPanelOpened?: () => void
}

/** AI 가 처음 인사할 때 쓰는 고정 문구(줄바꿈 포함) */
const WELCOME_TEXT = `안녕하세요. '루틴 도우미'에요!
원하는 키워드를 클릭하거나 직접 입력해보세요.
예) '4월 25일 체육대회 등록해줘'`

/** 세부 인텐트 한 칩 — 라벨(표시) + 채팅에 넣을 질문세트(여러 줄) */
type RoutineIntentChip = { id: string; label: string; prompt: string }

/** 카테고리(탭) 하나 — 아래에 세부 인텐트 칩이 2개 붙습니다 */
type RoutineIntentCategory = {
  id: string
  label: string
  /** 탭(선택/비선택)에 쓰는 테일윈드 클래스 */
  tabActiveClass: string
  tabInactiveClass: string
  intents: [RoutineIntentChip, RoutineIntentChip]
}

/**
 * 4대 카테고리 × 세부 인텐트 2개 = 8칩.
 * 각 prompt 는 부모가 답하기 쉬운 질문세트(번호 목록)로 구성했습니다.
 */
const INTENT_CATEGORIES: RoutineIntentCategory[] = [
  {
    id: 'cat_schedule',
    label: '일정추가',
    tabActiveClass: 'border-teal-300 bg-teal-50 text-teal-950 shadow-sm',
    tabInactiveClass: 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
    intents: [
      {
        id: 'intent_school_event',
        label: '학교행사',
        prompt: `【학교 행사 일정】 아래에 순서대로 적어 주시면 일정 반영에 도움이 됩니다.

1) 행사 이름과 날짜(또는 기간)를 알려 주세요.
2) 하루 종일인가요? 몇 시부터 몇 시까지인가요?
3) 그날은 미션·루틴을 어떻게 할까요? (휴일 루틴 / 완화 / 없음 등)
4) 학교 안내문·시간표 이미지가 있으면 첨부해 주셔도 됩니다.`,
      },
      {
        id: 'intent_public_holiday',
        label: '공휴일',
        prompt: `【공휴일 반영】 아래를 채워 주세요.

1) 넣고 싶은 공휴일 날짜(또는 이름: 예 설날)를 알려 주세요.
2) 그날 루틴은 어떻게 할까요? (휴일 루틴 적용 / 미션 없음 등)
3) 연휴라면 시작일과 종료일을 함께 적어 주세요.`,
      },
    ],
  },
  {
    id: 'cat_family_trip',
    label: '가족여행',
    tabActiveClass: 'border-amber-300 bg-amber-50 text-amber-950 shadow-sm',
    tabInactiveClass: 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
    intents: [
      {
        id: 'intent_family_trip',
        label: '가족여행',
        prompt: `【가족 여행】 일정을 맞춰 볼게요. 아래에 답해 주세요.

1) 여행지(또는 목적)와 출발·복귀 날짜를 알려 주세요.
2) 여행 중 미션·저충은 어떻게 할까요? (유지 / 완화 / 중단 등)
3) 이동이 긴 날(비행기·기차 등)이 있나요? 있다면 날짜를 적어 주세요.`,
      },
      {
        id: 'intent_pause_short',
        label: '잠깐멈춤',
        prompt: `【잠깐 멈춤(일시 중단)】 아래를 알려 주세요.

1) 멈추고 싶은 기간의 시작일·종료일을 적어 주세요.
2) 그동안 루틴은 어떻게 할까요? (완전 휴식 / 최소만 유지 등)
3) 멈추는 이유가 있다면 간단히 적어 주세요. (선택)`,
      },
    ],
  },
  {
    id: 'cat_vacation',
    label: '방학설정',
    tabActiveClass: 'border-violet-300 bg-violet-50 text-violet-950 shadow-sm',
    tabInactiveClass: 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
    intents: [
      {
        id: 'intent_vacation_plan',
        label: '방학계획',
        prompt: `【방학 계획】 아래 질문에 답해 주세요.

1) 방학 시작일과 종료일을 알려 주세요.
2) 방학 중에 아이와 함께 두고 싶은 목표(미션·생활 패턴)가 있나요?
3) 중간에 학교에 가는 날이나 짧은 등교가 있나요?`,
      },
      {
        id: 'intent_special_mission',
        label: '특별미션',
        prompt: `【특별 미션】 맞춤 아이디어를 드릴게요.

1) 다루고 싶은 주제가 있나요? (예: 독서, 운동, 생활습관)
2) 원하는 기간과 난이도(쉬움 / 보통 / 도전)를 알려 주세요.
3) 평소 루틴과 겹치지 않게 구성할까요? (예/아니오 + 원하는 방식)`,
      },
    ],
  },
  {
    id: 'cat_mission_suggest',
    label: '미션제안',
    tabActiveClass: 'border-rose-300 bg-rose-50 text-rose-950 shadow-sm',
    tabInactiveClass: 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
    intents: [
      {
        id: 'intent_savings_mission',
        label: '저축미션',
        prompt: `【저축 미션】 아래를 알려 주세요.

1) 아이 나이대와 현재 용돈·저축 방식이 있나요?
2) 목표 금액이나 저축 이유가 있나요?
3) 하루 단위와 주 단위 중 어떤 주기가 편하세요?`,
      },
      {
        id: 'intent_challenge_mission',
        label: '도전미션',
        prompt: `【도전 미션】 제안에 쓸 정보예요.

1) 아이가 좋아하거나 잘하는 활동이 있나요?
2) 조금 어렵지만 해 보고 싶은 영역이 있나요?
3) 원하는 기간(일주일 / 한 달 등)과 보상 방식이 있나요?`,
      },
    ],
  },
]

/** 세부 칩 2개에 쓰는 파스텔 스타일(카테고리별 톤에 맞춤) */
const SUBCHIP_STYLES_BY_CATEGORY: Record<string, [string, string]> = {
  cat_schedule: [
    'border-teal-100 bg-teal-50/90 text-teal-900',
    'border-teal-100 bg-teal-50/90 text-teal-900',
  ],
  cat_family_trip: [
    'border-amber-100 bg-amber-50/90 text-amber-900',
    'border-amber-100 bg-amber-50/90 text-amber-900',
  ],
  cat_vacation: [
    'border-violet-100 bg-violet-50/90 text-violet-900',
    'border-violet-100 bg-violet-50/90 text-violet-900',
  ],
  cat_mission_suggest: [
    'border-rose-100 bg-rose-50/90 text-rose-900',
    'border-rose-100 bg-rose-50/90 text-rose-900',
  ],
}

/** 캘린더(EventSheet)와 같은 네 가지 일정 종류 라벨 */
const EVENT_TYPES_ORDER: LocalCalendarEvent['eventType'][] = ['holiday', 'vacation', 'special', 'other']
const EVENT_TYPE_LABELS: Record<LocalCalendarEvent['eventType'], string> = {
  holiday: '공휴일',
  vacation: '방학',
  special: '기념일',
  other: '기타',
}

type SuggestionUi = AgentParseSuggestion & { status: 'pending' | 'approved' | 'rejected' }

type ChatTextMessage = { id: string; kind: 'text'; role: 'user' | 'assistant'; text: string }

/** 다건 스캔 후 한 줄의 상태 — ‘등록’하면 서버 제안이 slotSuggestions 에 붙습니다 */
type MultiSlotUi = {
  event: AgentParseEvent
  status: 'pending' | 'skipped' | 'committed'
  slotSuggestions: SuggestionUi[]
  /** commit-schedule 응답의 `saved_event_id` — 로컬 캘린더 행 id 와 같아 확인 카드에서 수정 시 패치에 씁니다 */
  savedEventId?: string | null
  /** `syncAgentEventToLocalCalendar` 가 반환한 id — 서버 id 가 없을 때 패치에 사용 */
  calendarRowId?: string | null
  /** 다건 슬롯에서 루틴 확인 카드 등록까지 끝난 뒤 성공 문구만 보일 때 true */
  routineCardComplete?: boolean
}

/** 다건 슬롯이 모두 등록·건너뛰기 처리됐는지 */
function isMultiAllReviewedSlots(slots: MultiSlotUi[]) {
  return slots.length > 0 && slots.every((s) => s.status === 'committed' || s.status === 'skipped')
}

type ChatParseMessage = {
  id: string
  kind: 'parse'
  role: 'assistant'
  parseResult: AgentParseResponse
  suggestions: SuggestionUi[]
  /** 이번 parse 와 동일한 조건으로 commit API 를 부를 때 씁니다 */
  agentCall?: { input_type: 'text' | 'image'; text_input?: string }
  multiSlots?: MultiSlotUi[]
  /** multiSlots 가 있을 때만 씀 — 현재 몇 번째 일정을 보고 있는지 */
  multiIndex?: number
  /** 다건에서 등록/건너뛰기로 모두 처리했을 때 한 번만 true */
  multiReviewComplete?: boolean
  /** [등록하기] 까지 끝난 단건·다건 슬롯 — 확인 카드를 성공 문구로 바꿉니다 */
  confirmComplete?: boolean
  /** `syncAgentEventToLocalCalendar` 가 돌려준 행 id — 서버 `saved_event_id` 가 비어도 패치 가능 */
  calendarRowId?: string | null
  /** 로컬 규칙 파싱만 한 경우 true — parse 직후엔 달력에 안 붙이고 등록 시 한 번에 저장 */
  deferCalendarSync?: boolean
}

type ChatMessage = ChatTextMessage | ChatParseMessage

/** data URL 에서 순수 base64 문자열만 떼어냅니다(서버에 그대로 보내기 위함) */
function stripDataUrlBase64(dataUrl: string): string {
  const i = dataUrl.indexOf('base64,')
  if (i === -1) return dataUrl.trim()
  return dataUrl.slice(i + 'base64,'.length).trim()
}

/** `schedules_api` 만 오는 최신 서버 응답 → `schedules` + `mode` 로 통일 */
function scheduleRowFromApi(pe: AgentParseApiRow): AgentParsedScheduleRow {
  const t = String(pe.event_type ?? pe.type ?? 'etc')
  const desc = String(pe.description ?? pe.note ?? '').trim()
  const event: AgentParseEvent = {
    type: t,
    title: String(pe.title ?? '').trim() || '일정',
    start_date: String(pe.start_date ?? '').trim(),
    end_date: pe.end_date ?? null,
    ...(desc ? { description: desc } : {}),
    ...(typeof pe.routine_off === 'boolean' ? { routine_off: pe.routine_off } : {}),
  }
  return { event, suggestions: [] }
}

/** 구버전 에이전트(`mode` 없음, `schedules_api` 만 multi)도 깨지지 않게 맞춥니다 */
function normalizeParseResponse(raw: AgentParseResponse): AgentParseResponse {
  const mode: AgentParseResponse['mode'] =
    raw.mode ?? (raw.type === 'multi' ? 'multi' : raw.type === 'single' ? 'single' : 'single')

  let schedules = raw.schedules ?? null
  if (
    mode === 'multi' &&
    Array.isArray(raw.schedules_api) &&
    raw.schedules_api.length > 0 &&
    (!schedules || schedules.length === 0)
  ) {
    schedules = raw.schedules_api.map(scheduleRowFromApi)
  }

  return {
    ...raw,
    mode,
    schedules,
    event: raw.event,
    suggestions: raw.suggestions ?? [],
    saved_event_id: raw.saved_event_id ?? null,
  }
}

/** 일정 유형 코드 → 한글 라벨 (학사일정표 JSON 의 school 등) */
function agentEventTypeLabel(code: string): string {
  const c = (code || '').toLowerCase()
  if (c === 'school') return '학교행사'
  if (c === 'holiday') return '휴일·휴업'
  if (c === 'vacation') return '방학·돌봄'
  if (c === 'travel') return '여행'
  if (c === 'birthday') return '기념일'
  if (c === 'special') return '기념일'
  if (c === 'other') return '기타'
  return '기타'
}

/** YYYY-MM-DD 가 속한 요일을 짧은 한글로 (예: 토) */
function weekdayKoFromYmd(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim())
  if (!m) return ''
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const dt = new Date(y, mo, d)
  if (Number.isNaN(dt.getTime())) return ''
  return new Intl.DateTimeFormat('ko-KR', { weekday: 'short' }).format(dt)
}

/** 제안 `type` 문자열을 소문자로 정규화(서버가 대소문자 섞어 줄 수 있음) */
function suggestionTypeNorm(t: string | undefined): string {
  return String(t ?? '')
    .trim()
    .toLowerCase()
}

/** `routine_off` 제안인지 — 이날 루틴 끄기 토글과 연결 */
function isRoutineOffSuggestion(s: Pick<SuggestionUi, 'type'>): boolean {
  return suggestionTypeNorm(s.type) === 'routine_off'
}

function pendingSuggestions(suggestions: SuggestionUi[]) {
  return suggestions.filter((s) => s.status === 'pending')
}

/** [등록하기] 성공 후 로컬 상태를 서버와 같은 의미로 맞춤 */
function mapSuggestionsAfterApprove(suggestions: SuggestionUi[], routineOffOn: boolean): SuggestionUi[] {
  return suggestions.map((s) => {
    if (s.status !== 'pending') return s
    /** 서버 제안 id 가 없으면(로컬 전용 파싱) API 없이 상태만 맞춥니다 */
    if (!s.suggestion_id) {
      if (isRoutineOffSuggestion(s)) return { ...s, status: routineOffOn ? 'approved' : 'rejected' }
      return { ...s, status: 'approved' as const }
    }
    if (isRoutineOffSuggestion(s)) return { ...s, status: routineOffOn ? 'approved' : 'rejected' }
    return { ...s, status: 'approved' as const }
  })
}

function mapSuggestionsAfterRejectAll(suggestions: SuggestionUi[]): SuggestionUi[] {
  return suggestions.map((s) => (s.status === 'pending' ? { ...s, status: 'rejected' as const } : s))
}

/** 확인 카드 [등록하기] 시 부모가 로컬 캘린더·제안 승인에 함께 넘길 값 */
type ScheduleConfirmRegisterPayload = {
  title: string
  startDate: string
  endDate: string
  /** 슬롯에서 고른 에이전트 유형 코드 (`school` … `etc`) */
  agentTypeCode: string
  routineOffOn: boolean
  description: string
}

/** 행 한 줄 — 누르면 연한 파란 배경으로 어떤 칸을 고치는 중인지 보여 줍니다 */
function ConfirmRow(props: {
  label: string
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      className={`flex w-full items-start gap-2 rounded-xl px-2 py-2 text-left transition ${
        props.active ? 'bg-sky-100/80 ring-1 ring-sky-200/80' : 'bg-white/60 hover:bg-sky-50/80'
      } disabled:opacity-50`}
    >
      <span className="w-12 shrink-0 pt-0.5 text-[10px] font-black text-gray-500">{props.label}</span>
      <div className="min-w-0 flex-1 text-[12px] font-bold text-gray-900">{props.children}</div>
    </button>
  )
}

/**
 * 통합 등록 카드 — 제목·날짜·유형 슬롯 피커·루틴·설명을 한곳에서 고친 뒤 등록합니다.
 * - `layout="compact"`: 다건 커밋 뒤에는 위쪽 카드에 제목이 있으므로 한 줄 요약만 더 보여 줍니다.
 */
function UnifiedScheduleConfirmCard(props: {
  layout: 'full' | 'compact'
  event: AgentParseEvent
  suggestions: SuggestionUi[]
  busy: boolean
  /** 부모가 [등록하기] 완료로 바꾼 뒤에는 짧은 성공 문구만 보여 줍니다 */
  registrationComplete?: boolean
  onRegister: (payload: ScheduleConfirmRegisterPayload) => void | Promise<void>
  onCancel: () => void | Promise<void>
}) {
  const { layout, event: ev, suggestions, busy, registrationComplete, onRegister, onCancel } = props
  const descFieldId = useId()
  const pending = pendingSuggestions(suggestions)

  const [titleDraft, setTitleDraft] = useState(() => (ev.title || '일정').trim())
  const [editingTitle, setEditingTitle] = useState(false)
  const [startIso, setStartIso] = useState(() => (ev.start_date || '').trim() || getSeoulDateString())
  const [endIso, setEndIso] = useState(() => {
    const e = (ev.end_date && String(ev.end_date).trim()) || ''
    const s = (ev.start_date || '').trim() || getSeoulDateString()
    return e || s
  })
  const [agentCode, setAgentCode] = useState(() => normalizeAgentTypeForPicker(ev.type))
  const [routineOffOn, setRoutineOffOn] = useState(
    () => Boolean(ev.routine_off) || pending.some((s) => isRoutineOffSuggestion(s)),
  )
  const [descriptionDraft, setDescriptionDraft] = useState(() => ev.description ?? '')
  const [openPicker, setOpenPicker] = useState<null | 'start' | 'end' | 'type'>(null)

  useEffect(() => {
    setTitleDraft((ev.title || '일정').trim())
    setStartIso((ev.start_date || '').trim() || getSeoulDateString())
    const e = (ev.end_date && String(ev.end_date).trim()) || ''
    const s = (ev.start_date || '').trim() || getSeoulDateString()
    setEndIso(e || s)
    setAgentCode(normalizeAgentTypeForPicker(ev.type))
    setDescriptionDraft(ev.description ?? '')
    setEditingTitle(false)
    setOpenPicker(null)
  }, [ev.title, ev.type, ev.start_date, ev.end_date, ev.description, ev.routine_off])

  useEffect(() => {
    const pend = suggestions.filter((s) => s.status === 'pending')
    setRoutineOffOn(Boolean(ev.routine_off) || pend.some((s) => isRoutineOffSuggestion(s)))
  }, [suggestions, ev.routine_off])

  const typeOptions = SCHEDULE_TYPE_PICKER_OPTIONS.map((o) => ({
    value: o.agentType,
    label: o.label,
  }))

  if (registrationComplete) {
    return (
      <div className="rounded-2xl border border-violet-100/90 bg-gradient-to-b from-violet-50/90 to-sky-50/70 px-3 py-3 text-center shadow-sm ring-1 ring-violet-100/50">
        <p className="text-[11px] font-bold text-violet-900">일정을 등록했어요</p>
      </div>
    )
  }

  /** 서버 제안이 있었는데 모두 승인·거절된 뒤(취소 등)에는 편집 폼 대신 짧은 안내만 보여 줍니다 */
  if (suggestions.length > 0 && pending.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50/90 px-3 py-2.5 text-center shadow-sm ring-1 ring-gray-100">
        <p className="text-[10px] font-bold text-gray-600">루틴 제안 처리를 마쳤어요</p>
      </div>
    )
  }

  const heading = layout === 'full' ? '일정을 등록할까요?' : '이 일정의 루틴을 적용할까요?'

  return (
    <div className="rounded-2xl border border-violet-100/90 bg-gradient-to-b from-violet-50/90 via-white to-sky-50/80 p-3 shadow-md ring-1 ring-sky-100/60">
      <p className="text-center text-xs font-black text-violet-950">{heading}</p>
      <div className="my-2 border-t border-violet-100/80" />

      {layout === 'compact' ? (
        <p className="mb-2 rounded-lg bg-white/70 px-2 py-1.5 text-[10px] font-bold text-gray-700 ring-1 ring-gray-100">
          {titleDraft} · {startIso}
          {endIso !== startIso ? ` ~ ${endIso}` : ''}
        </p>
      ) : null}

      {editingTitle ? (
        <input
          autoFocus
          disabled={busy}
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => setEditingTitle(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setEditingTitle(false)
          }}
          className="mb-1 w-full rounded-xl border border-violet-200 bg-white px-2 py-2 text-[12px] font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-blue/25"
        />
      ) : (
        <ConfirmRow label="제목" active={false} disabled={busy} onClick={() => setEditingTitle(true)}>
          {titleDraft || '일정'}
        </ConfirmRow>
      )}

      <ConfirmRow
        label="날짜"
        active={openPicker === 'start'}
        disabled={busy}
        onClick={() => setOpenPicker((p) => (p === 'start' ? null : 'start'))}
      >
        {startIso}
      </ConfirmRow>
      <RoutineAgentPickerPresence show={openPicker === 'start'}>
        <RoutineAgentDateSlotPicker
          value={startIso}
          onChange={(iso) => {
            setStartIso(iso)
            if (endIso < iso) setEndIso(iso)
          }}
          onDone={() => setOpenPicker(null)}
        />
      </RoutineAgentPickerPresence>

      <ConfirmRow
        label="종료일"
        active={openPicker === 'end'}
        disabled={busy}
        onClick={() => setOpenPicker((p) => (p === 'end' ? null : 'end'))}
      >
        {endIso}
      </ConfirmRow>
      <RoutineAgentPickerPresence show={openPicker === 'end'}>
        <RoutineAgentDateSlotPicker
          value={endIso}
          onChange={(iso) => {
            setEndIso(iso)
            if (iso < startIso) setStartIso(iso)
          }}
          onDone={() => setOpenPicker(null)}
        />
      </RoutineAgentPickerPresence>

      <ConfirmRow
        label="유형"
        active={openPicker === 'type'}
        disabled={busy}
        onClick={() => setOpenPicker((p) => (p === 'type' ? null : 'type'))}
      >
        {agentTypeToPickerLabel(agentCode)}
      </ConfirmRow>
      <RoutineAgentPickerPresence show={openPicker === 'type'}>
        <RoutineAgentTypeSlotPicker
          options={typeOptions}
          value={agentCode}
          onPick={(v) => {
            setAgentCode(v as typeof agentCode)
            setOpenPicker(null)
          }}
        />
      </RoutineAgentPickerPresence>

      <div className="mt-1 rounded-xl bg-white/70 px-2 py-2 ring-1 ring-gray-100">
        <p className="mb-1 text-[10px] font-black text-gray-500">루틴</p>
        <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-0.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => setRoutineOffOn(true)}
            className={`min-w-0 flex-1 rounded-lg py-1.5 text-[11px] font-black transition ${
              routineOffOn ? 'bg-violet-500 text-white shadow-sm' : 'text-gray-500'
            }`}
          >
            끄기
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setRoutineOffOn(false)}
            className={`min-w-0 flex-1 rounded-lg py-1.5 text-[11px] font-black transition ${
              !routineOffOn ? 'bg-sky-500 text-white shadow-sm' : 'text-gray-500'
            }`}
          >
            유지
          </button>
        </div>
        <p className="mt-1 text-[9px] font-medium text-gray-400">
          {routineOffOn ? '그날은 미션·루틴을 쉬게 해요.' : '휴일 루틴 패턴을 유지해요.'}
        </p>
      </div>

      <div className="mt-2">
        <label className="mb-1 block text-[10px] font-bold text-gray-500" htmlFor={descFieldId}>
          설명
        </label>
        <textarea
          id={descFieldId}
          disabled={busy}
          value={descriptionDraft}
          maxLength={200}
          onChange={(e) => setDescriptionDraft(e.target.value.slice(0, 200))}
          rows={layout === 'full' ? 3 : 2}
          placeholder="추가 설명을 입력하세요 (선택)"
          className="routine-agent-hide-scrollbar w-full resize-none rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-[11px] leading-relaxed text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-blue/25 disabled:opacity-50"
        />
        <p className="mt-0.5 text-right text-[9px] text-gray-400">{descriptionDraft.length}/200</p>
      </div>

      <div className="my-2 border-t border-violet-100/80" />

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || !titleDraft.trim()}
          onClick={() =>
            void onRegister({
              title: titleDraft.trim(),
              startDate: startIso,
              endDate: endIso < startIso ? startIso : endIso,
              agentTypeCode: agentCode,
              routineOffOn,
              description: descriptionDraft.trim(),
            })
          }
          className="min-w-0 flex-1 rounded-xl bg-emerald-500 py-2.5 text-[11px] font-black text-white shadow-sm active:scale-[0.99] disabled:opacity-50"
        >
          등록하기
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onCancel()}
          className="min-w-0 flex-1 rounded-xl border border-rose-100 bg-rose-50 py-2.5 text-[11px] font-black text-rose-900 shadow-sm active:scale-[0.99] disabled:opacity-50"
        >
          취소
        </button>
      </div>
    </div>
  )
}

/**
 * PNG·WebP 등을 JPEG 로 바꿔 용량을 줄입니다.
 * (서버가 예전처럼 JPEG 만 가정해도 되고, JSON 본문이 너무 커지는 것도 막습니다.)
 */
async function compressImageFileToJpegPayload(
  file: File,
  maxSide = 1400,
  quality = 0.82,
): Promise<{ previewUrl: string; base64: string } | null> {
  if (typeof createImageBitmap !== 'function') return null
  try {
    const bmp = await createImageBitmap(file)
    const w0 = bmp.width
    const h0 = bmp.height
    const max0 = Math.max(w0, h0)
    const scale = max0 > maxSide ? maxSide / max0 : 1
    const tw = Math.max(1, Math.round(w0 * scale))
    const th = Math.max(1, Math.round(h0 * scale))
    const canvas = document.createElement('canvas')
    canvas.width = tw
    canvas.height = th
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bmp, 0, 0, tw, th)
    try {
      bmp.close()
    } catch {
      /* 일부 환경에서는 close 가 없을 수 있음 */
    }
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    return { previewUrl: dataUrl, base64: stripDataUrlBase64(dataUrl) }
  } catch {
    return null
  }
}

function newId() {
  return crypto.randomUUID()
}

export default function RoutineAgentSchedulePanel({
  open,
  onClose,
  familyLinkId,
  childId,
  onToast,
  onAssistantRepliesWhileClosed,
  onPanelOpened,
}: Props) {
  const [mounted, setMounted] = useState(false)
  /** 채팅 말풍선 목록(위에서 아래로 시간 순) */
  const [messages, setMessages] = useState<ChatMessage[]>([])
  /** 하단 입력창 — 사용자가 직접 타이핑하는 내용 */
  const [composerText, setComposerText] = useState('')
  /** 이미지 미리보기(data URL)와 서버용 base64(접두사 제거) */
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  /** 통합 제안 카드에서 POST /agent-b/approve 연속 호출 중 — `parseMsgId` 또는 `parseMsgId:slotIndex` */
  const [suggestionSubmitKey, setSuggestionSubmitKey] = useState<string | null>(null)
  /** [직접 입력하기] 펼침 여부 */
  const [directOpen, setDirectOpen] = useState(false)
  /**
   * 인텐트 UI: 세부 칩을 펼친 카테고리 id.
   * null 이면 접힘(카테고리만 보임). 탭 클릭 시 해당 id 로 펼침, 같은 탭 재클릭 시 다시 접음.
   */
  const [expandedIntentCategoryId, setExpandedIntentCategoryId] = useState<string | null>(null)
  /**
   * 다건 일정 카드에서 [수정하기] 로 연 필드 임시값.
   * parse 말풍선 id + 슬롯 인덱스가 일치할 때만 해당 슬롯 위에 편집 폼을 띄웁니다.
   */
  const [multiEdit, setMultiEdit] = useState<{
    parseMsgId: string
    slotIndex: number
    title: string
    start_date: string
    end_date: string
    type: string
    description: string
  } | null>(null)
  /** 직접 입력 폼 — 캘린더 일정 추가와 같은 항목 */
  const todayStr = getSeoulDateString()
  const [dTitle, setDTitle] = useState('')
  const [dStart, setDStart] = useState(todayStr)
  const [dEnd, setDEnd] = useState(todayStr)
  const [dType, setDType] = useState<LocalCalendarEvent['eventType']>('holiday')
  const [dOverride, setDOverride] = useState<LocalCalendarEvent['routineOverride']>('weekend')
  const [dDesc, setDDesc] = useState('')

  const fileRef = useRef<HTMLInputElement>(null)
  const listEndRef = useRef<HTMLDivElement>(null)
  /** 비동기(parse)가 끝날 때 패널이 열려 있는지 — 닫힌 뒤 완료되면 미읽음만 올립니다 */
  const openRef = useRef(open)
  useEffect(() => {
    openRef.current = open
  }, [open])

  /** 자녀·가족 연결이 바뀌면 대화를 새로 시작합니다(닫기만으로는 초기화하지 않음) */
  const agentSessionScopeRef = useRef<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  /** 패널이 열릴 때마다(닫았다가 다시 열기 포함) 플로팅 배지를 초기화합니다 */
  const prevOpenRef = useRef(false)
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      onPanelOpened?.()
    }
    prevOpenRef.current = open
  }, [open, onPanelOpened])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  /**
   * 부모 탭 레이아웃의 `<main>`(세로 스크롤) 막대가 챗봇 반투명 배경보다 위에 그려지는 문제를 막습니다.
   * - 패널이 열린 동안만 `overflow: hidden` 을 걸고, 닫히면 원래 인라인 스타일로 되돌립니다.
   * - `body` 도 같이 잠그면 이중 스크롤(특히 모바일)을 줄일 수 있어 함께 처리합니다.
   */
  useEffect(() => {
    if (!open) return
    const main = document.getElementById(PARENT_TABS_MAIN_SCROLL_EL_ID) as HTMLElement | null
    const prevMainOverflow = main?.style.overflow ?? ''
    const prevBodyOverflow = document.body.style.overflow

    if (main) main.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'

    return () => {
      if (main) main.style.overflow = prevMainOverflow
      document.body.style.overflow = prevBodyOverflow
    }
  }, [open])

  /**
   * 대화·입력 폼을 비웁니다.
   * - **자녀 또는 가족 연결이 바뀔 때만** 호출해 새 아이 기준으로 챗을 시작합니다.
   * - 패널을 닫을 때는 호출하지 않아, 부모가 나중에 다시 열어도 말풍선이 그대로 남습니다.
   */
  const resetAll = useCallback(() => {
    setMessages([])
    setComposerText('')
    setImagePreview(null)
    setImageBase64(null)
    setLoading(false)
    setDirectOpen(false)
    setDTitle('')
    setDStart(getSeoulDateString())
    setDEnd(getSeoulDateString())
    setDType('holiday')
    setDOverride('weekend')
    setDDesc('')
    if (fileRef.current) fileRef.current.value = ''
    setExpandedIntentCategoryId(null)
    setMultiEdit(null)
  }, [])

  /**
   * `childId` / `familyLinkId` 가 바뀌면 이전 아이와의 대화를 지우고 환영 말풍선만 둡니다.
   * (같은 아이로 루틴 탭을 벗어났다가 돌아오면 컴포넌트가 다시 마운트되면서 ref 가 초기화될 수 있어,
   *  그때도 한 번 환영이 붙을 수 있습니다 — 의도된 “새 세션” 동작에 가깝습니다.)
   */
  useEffect(() => {
    if (!childId || !familyLinkId) return
    const scope = `${familyLinkId}:${childId}`
    if (agentSessionScopeRef.current === scope) return
    agentSessionScopeRef.current = scope
    resetAll()
    setMessages([{ id: newId(), kind: 'text', role: 'assistant', text: WELCOME_TEXT }])
  }, [childId, familyLinkId, resetAll])

  /** 패널이 닫혀 있는 동안 새 AI 답장이 생기면 부모에게 숫자만 넘깁니다 */
  const bumpUnreadIfClosed = useCallback(
    (delta: number) => {
      if (delta < 1) return
      if (!openRef.current) onAssistantRepliesWhileClosed?.(delta)
    },
    [onAssistantRepliesWhileClosed],
  )

  /** 새 말풍선이 생기면 목록 맨 아래로 스크롤 */
  useEffect(() => {
    if (!open) return
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, open])

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    void (async () => {
      const f = e.target.files?.[0]
      if (!f) return
      if (!f.type.startsWith('image/')) {
        onToast('이미지 파일만 선택할 수 있어요', false)
        return
      }
      const compressed = await compressImageFileToJpegPayload(f)
      if (compressed) {
        setImagePreview(compressed.previewUrl)
        setImageBase64(compressed.base64)
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const r = String(reader.result ?? '')
        setImagePreview(r)
        setImageBase64(stripDataUrlBase64(r))
      }
      reader.readAsDataURL(f)
    })()
  }

  /** `/agent-b/parse` 공통 호출 — 성공 시 파싱 결과 말풍선을 붙입니다 */
  const runParse = async (body: {
    family_link_id: string
    child_id: string
    input_type: 'text' | 'image'
    text_input?: string
    image_base64?: string
  }) => {
    if (!familyLinkId || !childId) {
      onToast('가족 연결 정보를 찾을 수 없어요. 잠시 후 다시 시도해 주세요.', false)
      return
    }
    setLoading(true)
    try {
      const resRaw = await postAgentParse(body)
      const res = normalizeParseResponse(resRaw)
      const isMulti = res.mode === 'multi' && (res.schedules?.length ?? 0) > 0
      const multiSlots: MultiSlotUi[] | undefined = isMulti
        ? (res.schedules ?? []).map((row) => ({
            event: row.event,
            status: 'pending' as const,
            slotSuggestions: [],
          }))
        : undefined
      const sug: SuggestionUi[] = (res.suggestions ?? []).map((s) => ({ ...s, status: 'pending' as const }))
      /**
       * 단건인데 제목/설명에 추출 오류·503 이 섞여 오면 성공이 아님 — 캘린더 동기화·파싱 카드 모두 생략.
       * (그대로 두면 오늘 날짜에 사용자 문장 전체가 제목인 일정이 생김)
       */
      if (!isMulti && shouldSkipSyncAgentEvent(res.event)) {
        onToast('AI 서버가 잠시 바빠 일정을 읽지 못했어요. 잠시 후 다시 시도해 주세요.', false, true)
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            kind: 'text',
            role: 'assistant',
            text: '지금은 요청이 많아 응답이 지연되고 있어요. 잠시 후 같은 내용으로 다시 보내 주세요.',
          },
        ])
        bumpUnreadIfClosed(1)
        return
      }
      /** 단건 파싱: 서버 초안과 동일 일정을 부모 캘린더(localStorage)에도 반영 — 행 id 를 나중에 [등록하기] 패치에 씁니다 */
      let calendarRowId: string | null = null
      if (!isMulti) {
        calendarRowId = syncAgentEventToLocalCalendar(childId, res.event, res.saved_event_id ?? null)
      }
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          kind: 'parse',
          role: 'assistant',
          parseResult: res,
          suggestions: isMulti ? [] : sug,
          agentCall: { input_type: body.input_type, text_input: body.text_input },
          multiSlots,
          multiIndex: isMulti ? 0 : undefined,
          calendarRowId,
          deferCalendarSync: false,
        },
      ])
      bumpUnreadIfClosed(1)
      onToast(isMulti ? `일정 ${multiSlots?.length ?? 0}건을 찾았어요. 한 건씩 확인해 주세요` : 'AI 분석이 완료됐어요')
    } catch (err) {
      onToast(err instanceof Error ? err.message : '분석에 실패했어요', false, true)
    } finally {
      setLoading(false)
    }
  }

  /** 채팅창에서 [보내기] — 텍스트와(선택) 이미지를 함께 보냅니다 */
  const handleSendComposer = async () => {
    if (!familyLinkId || !childId) {
      onToast('가족 연결 정보를 찾을 수 없어요. 잠시 후 다시 시도해 주세요.', false)
      return
    }
    const trimmed = composerText.trim()
    const hasImg = Boolean(imageBase64 && imageBase64.length > 0)
    if (!hasImg && !trimmed) {
      onToast('메시지를 입력하거나 이미지를 첨부해 주세요', false)
      return
    }
    setMessages((prev) => [...prev, { id: newId(), kind: 'text', role: 'user', text: trimmed || '(이미지 첨부)' }])
    setComposerText('')
    const b64 = imageBase64
    setImagePreview(null)
    setImageBase64(null)
    if (fileRef.current) fileRef.current.value = ''

    if (hasImg) {
      await runParse({
        family_link_id: familyLinkId,
        child_id: childId,
        input_type: 'image',
        image_base64: b64!,
        text_input: trimmed || undefined,
      })
    } else {
      /** 날짜·행사 키워드가 분명하면 브라우저에서만 JSON 을 만들고, 애매할 때만 에이전트를 부릅니다 */
      if (!shouldCallAPI(trimmed, false)) {
        const localPlan = buildScheduleFromText(trimmed)
        if (localPlan) {
          const res = buildAgentParseResponseFromLocal(localPlan)
          const sug: SuggestionUi[] = (res.suggestions ?? []).map((s) => ({ ...s, status: 'pending' as const }))
          setMessages((prev) => [
            ...prev,
            {
              id: newId(),
              kind: 'parse',
              role: 'assistant',
              parseResult: res,
              suggestions: sug,
              deferCalendarSync: true,
              calendarRowId: null,
            },
          ])
          bumpUnreadIfClosed(1)
          onToast('문장을 바로 해석했어요. 아래에서 확인 후 등록해 주세요')
          return
        }
      }
      await runParse({
        family_link_id: familyLinkId,
        child_id: childId,
        input_type: 'text',
        text_input: trimmed,
      })
    }
  }

  /** 인텐트 칩 — 질문세트를 어시스턴트 말풍선으로 채팅에 추가 */
  const pushIntentQuestionSet = (prompt: string) => {
    setMessages((prev) => [...prev, { id: newId(), kind: 'text', role: 'assistant', text: prompt }])
  }

  /** 펼쳐진 카테고리에 대응하는 데이터(접혀 있으면 null) */
  const activeIntentCategory =
    expandedIntentCategoryId == null
      ? null
      : (INTENT_CATEGORIES.find((c) => c.id === expandedIntentCategoryId) ?? null)

  /** 카테고리 탭 클릭: 다른 탭이면 펼침, 이미 펼친 같은 탭이면 접기 */
  const onIntentCategoryTabClick = (catId: string) => {
    setExpandedIntentCategoryId((prev) => (prev === catId ? null : catId))
  }

  /**
   * 직접 입력 폼 [저장]
   * - 이 경로는 확인 카드 없이 **즉시 캘린더에 반영**합니다.
   * - 저장 성공 시 폼을 자동으로 닫고, 다음 입력을 위해 기본값으로 되돌립니다.
   */
  const handleDirectSave = async () => {
    const title = dTitle.trim()
    if (!title) {
      onToast('일정 이름을 입력해 주세요', false)
      return
    }
    if (!dStart.trim() || !dEnd.trim()) {
      onToast('시작일과 종료일을 입력해 주세요', false)
      return
    }
    if (!familyLinkId || !childId) {
      onToast('가족 연결 정보를 찾을 수 없어요. 잠시 후 다시 시도해 주세요.', false)
      return
    }

    /** 직접 입력 폼의 로컬 타입(holiday/vacation/special/other)을 에이전트 타입 문자열로 맞춥니다. */
    const typeCode =
      dType === 'holiday' ? 'holiday' : dType === 'vacation' ? 'vacation' : dType === 'special' ? 'birthday' : 'etc'
    const event: AgentParseEvent = {
      type: typeCode,
      title,
      start_date: dStart,
      end_date: dEnd === dStart ? null : dEnd,
      ...(dDesc.trim() ? { description: dDesc.trim() } : {}),
      routine_off: dOverride === 'none',
    }

    const rowId = syncAgentEventToLocalCalendar(childId, event, null, {
      routineOverride: dOverride,
    })
    if (!rowId) {
      onToast('직접 입력 일정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.', false)
      return
    }

    setDirectOpen(false)
    setDTitle('')
    setDStart(getSeoulDateString())
    setDEnd(getSeoulDateString())
    setDType('holiday')
    setDOverride('weekend')
    setDDesc('')
    onToast('일정을 바로 등록했어요')
  }

  /** 다건 스캔 중 한 줄을 DB 에 올리고, 그 줄에 대한 루틴 제안을 받아옵니다(말풍선에서 넘긴 slot/call 을 그대로 씀) */
  const handleMultiCommitSlot = async (
    parseMsgId: string,
    slotIndex: number,
    slot: MultiSlotUi,
    call: { input_type: 'text' | 'image'; text_input?: string },
  ) => {
    if (!familyLinkId || !childId) {
      onToast('가족 연결 정보를 찾을 수 없어요. 잠시 후 다시 시도해 주세요.', false)
      return
    }
    setLoading(true)
    try {
      const out = await postAgentCommitSchedule({
        family_link_id: familyLinkId,
        child_id: childId,
        input_type: call.input_type,
        text_input: call.text_input,
        event: slot.event,
      })
      if (shouldSkipSyncAgentEvent(out.event)) {
        onToast('일정을 저장하지 못했어요. AI 서버가 잠시 바쁩니다. 잠시 후 다시 시도해 주세요.', false, true)
        return
      }
      const slotSuggestions: SuggestionUi[] = (out.suggestions ?? []).map(
        (s): SuggestionUi => ({
          type: s.type,
          detail: s.detail,
          suggestion_id: s.suggestion_id,
          status: 'pending',
        }),
      )
      /** 다건 중 한 줄 커밋: 캘린더 UI(localStorage)에도 같은 일정을 붙여 달력 점이 보이게 함 */
      const calendarRowId = syncAgentEventToLocalCalendar(childId, out.event, out.saved_event_id ?? null)
      setMultiEdit((cur) => (cur?.parseMsgId === parseMsgId && cur.slotIndex === slotIndex ? null : cur))
      setMessages((prev) =>
        prev.map((m) => {
          if (m.kind !== 'parse' || m.id !== parseMsgId || !m.multiSlots) return m
          const nextSlots = m.multiSlots.map((s, j) =>
            j === slotIndex
              ? {
                  ...s,
                  status: 'committed' as const,
                  slotSuggestions,
                  savedEventId: out.saved_event_id ?? null,
                  calendarRowId,
                }
              : s,
          )
          const n = nextSlots.length
          const nextIdx = Math.min(slotIndex + 1, Math.max(0, n - 1))
          const done = isMultiAllReviewedSlots(nextSlots)
          return {
            ...m,
            multiSlots: nextSlots,
            multiIndex: nextIdx,
            multiReviewComplete: Boolean(m.multiReviewComplete || done),
          }
        }),
      )
      bumpUnreadIfClosed(1)
      onToast('이 일정을 등록했어요. 아래에서 루틴 제안을 한 번에 적용해 주세요')
    } catch (err) {
      onToast(err instanceof Error ? err.message : '등록에 실패했어요', false, true)
    } finally {
      setLoading(false)
    }
  }

  const handleMultiSkipSlot = (parseMsgId: string, slotIndex: number) => {
    setMultiEdit((cur) => (cur?.parseMsgId === parseMsgId && cur.slotIndex === slotIndex ? null : cur))
    setMessages((prev) =>
      prev.map((m) => {
        if (m.kind !== 'parse' || m.id !== parseMsgId || !m.multiSlots) return m
        const nextSlots = m.multiSlots.map((s, j) =>
          j === slotIndex ? { ...s, status: 'skipped' as const, slotSuggestions: [] } : s,
        )
        const n = nextSlots.length
        const nextIdx = Math.min(slotIndex + 1, Math.max(0, n - 1))
        const done = isMultiAllReviewedSlots(nextSlots)
        return {
          ...m,
          multiSlots: nextSlots,
          multiIndex: nextIdx,
          multiReviewComplete: Boolean(m.multiReviewComplete || done),
        }
      }),
    )
    onToast('이 일정은 건너뛸게요')
  }

  const setMultiIndex = (parseMsgId: string, next: number) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.kind !== 'parse' || m.id !== parseMsgId || !m.multiSlots) return m
        const n = m.multiSlots.length
        const clamped = Math.max(0, Math.min(n - 1, next))
        return { ...m, multiIndex: clamped }
      }),
    )
  }

  /** 다건 카드에서 [수정하기] — 현재 슬롯 일정을 임시 폼으로 불러옵니다 */
  const openMultiEdit = (parseMsgId: string, slotIndex: number, ev: AgentParseEvent) => {
    setMultiEdit({
      parseMsgId,
      slotIndex,
      title: ev.title ?? '',
      start_date: ev.start_date ?? '',
      end_date: (ev.end_date ?? ev.start_date ?? '') as string,
      type: ev.type ?? 'etc',
      description: ev.description ?? '',
    })
  }

  /** 임시 폼 내용을 해당 슬롯의 `event` 에 반영합니다 */
  const applyMultiEdit = () => {
    if (!multiEdit) return
    setMessages((prev) =>
      prev.map((m) => {
        if (m.kind !== 'parse' || m.id !== multiEdit.parseMsgId || !m.multiSlots) return m
        const nextSlots = m.multiSlots.map((s, j) => {
          if (j !== multiEdit.slotIndex) return s
          return {
            ...s,
            event: {
              ...s.event,
              title: multiEdit.title.trim() || '일정',
              start_date: multiEdit.start_date,
              end_date: multiEdit.end_date.trim() || multiEdit.start_date,
              type: multiEdit.type,
              description: multiEdit.description.trim() || undefined,
            },
          }
        })
        return { ...m, multiSlots: nextSlots }
      }),
    )
    setMultiEdit(null)
    onToast('이 일정 내용을 수정했어요')
  }

  /**
   * 통합 카드 [등록하기] — 대기 제안마다 POST /agent-b/approve.
   * `special_mission`·`extra_reward` 는 UI에 안 보이지만 여기서 **자동 승인**합니다.
   */
  const approvePendingSuggestionsBatch = async (
    pending: SuggestionUi[],
    routineOffOn: boolean,
  ): Promise<void> => {
    for (const s of pending) {
      /** 로컬 전용 제안은 서버 승인 URL 이 없으므로 호출을 생략합니다 */
      if (!s.suggestion_id) continue
      const action: 'approved' | 'rejected' =
        isRoutineOffSuggestion(s) && !routineOffOn ? 'rejected' : 'approved'
      await postAgentApprove(s.suggestion_id, action)
    }
  }

  const rejectPendingSuggestionsBatch = async (pending: SuggestionUi[]): Promise<void> => {
    for (const s of pending) {
      if (!s.suggestion_id) continue
      await postAgentApprove(s.suggestion_id, 'rejected')
    }
  }

  const handleUnifiedRegisterSingle = async (
    parseMsgId: string,
    suggestions: SuggestionUi[],
    payload: ScheduleConfirmRegisterPayload,
    savedCalendarEventId: string | null,
    calendarRowIdIn: string | null,
    baseEvent: AgentParseEvent,
  ) => {
    setSuggestionSubmitKey(parseMsgId)
    try {
      const mergedEvent: AgentParseEvent = {
        ...baseEvent,
        title: payload.title,
        start_date: payload.startDate,
        end_date: payload.endDate === payload.startDate ? null : payload.endDate,
        type: payload.agentTypeCode,
        ...(payload.description ? { description: payload.description } : {}),
        routine_off: payload.routineOffOn,
      }
      const localEventType = agentTypeToLocalCalendarType(payload.agentTypeCode)
      let rowId = savedCalendarEventId || calendarRowIdIn || null
      if (!rowId) {
        rowId = syncAgentEventToLocalCalendar(childId!, mergedEvent, null, {
          routineOverride: payload.routineOffOn ? 'none' : 'weekend',
        })
      } else {
        patchLocalCalendarEventInStorage(rowId, {
          title: payload.title,
          startDate: payload.startDate,
          endDate: payload.endDate,
          eventType: localEventType,
          description: payload.description,
          routineOverride: payload.routineOffOn ? 'none' : 'weekend',
        })
      }
      if (!rowId) {
        onToast('캘린더에 저장하지 못했어요. 잠시 후 다시 시도해 주세요.', false)
        return
      }
      const pending = pendingSuggestions(suggestions)
      await approvePendingSuggestionsBatch(pending, payload.routineOffOn)
      setMessages((prev) =>
        prev.map((m) =>
          m.kind === 'parse' && m.id === parseMsgId
            ? {
                ...m,
                confirmComplete: true,
                calendarRowId: rowId,
                parseResult: { ...m.parseResult, event: mergedEvent },
                suggestions: mapSuggestionsAfterApprove(m.suggestions, payload.routineOffOn),
              }
            : m,
        ),
      )
      onToast('적용했어요')
    } catch (e) {
      onToast(e instanceof Error ? e.message : '처리 실패', false)
    } finally {
      setSuggestionSubmitKey(null)
    }
  }

  const handleUnifiedCancelSingle = async (parseMsgId: string, suggestions: SuggestionUi[]) => {
    const pending = pendingSuggestions(suggestions)
    if (pending.length === 0) {
      onToast('취소할 제안이 없어요')
      return
    }
    setSuggestionSubmitKey(parseMsgId)
    try {
      await rejectPendingSuggestionsBatch(pending)
      setMessages((prev) =>
        prev.map((m) =>
          m.kind === 'parse' && m.id === parseMsgId
            ? { ...m, suggestions: mapSuggestionsAfterRejectAll(m.suggestions) }
            : m,
        ),
      )
      onToast('취소했어요')
    } catch (e) {
      onToast(e instanceof Error ? e.message : '처리 실패', false)
    } finally {
      setSuggestionSubmitKey(null)
    }
  }

  const handleUnifiedRegisterMulti = async (
    parseMsgId: string,
    slotIndex: number,
    payload: ScheduleConfirmRegisterPayload,
    slotSuggestions: SuggestionUi[],
    savedCalendarEventId: string | null,
    calendarRowIdIn: string | null,
    baseEvent: AgentParseEvent,
  ) => {
    const pending = pendingSuggestions(slotSuggestions)
    if (pending.length === 0) return
    const key = `${parseMsgId}:${slotIndex}`
    setSuggestionSubmitKey(key)
    try {
      const mergedEvent: AgentParseEvent = {
        ...baseEvent,
        title: payload.title,
        start_date: payload.startDate,
        end_date: payload.endDate === payload.startDate ? null : payload.endDate,
        type: payload.agentTypeCode,
        ...(payload.description ? { description: payload.description } : {}),
        routine_off: payload.routineOffOn,
      }
      const localEventType = agentTypeToLocalCalendarType(payload.agentTypeCode)
      let rowId = savedCalendarEventId || calendarRowIdIn || null
      if (!rowId) {
        rowId = syncAgentEventToLocalCalendar(childId!, mergedEvent, null, {
          routineOverride: payload.routineOffOn ? 'none' : 'weekend',
        })
      } else {
        patchLocalCalendarEventInStorage(rowId, {
          title: payload.title,
          startDate: payload.startDate,
          endDate: payload.endDate,
          eventType: localEventType,
          description: payload.description,
          routineOverride: payload.routineOffOn ? 'none' : 'weekend',
        })
      }
      if (!rowId) {
        onToast('캘린더에 저장하지 못했어요. 잠시 후 다시 시도해 주세요.', false)
        return
      }
      await approvePendingSuggestionsBatch(pending, payload.routineOffOn)
      setMessages((prev) =>
        prev.map((m) => {
          if (m.kind !== 'parse' || m.id !== parseMsgId || !m.multiSlots) return m
          const nextSlots = m.multiSlots.map((slot, j) =>
            j !== slotIndex
              ? slot
              : {
                  ...slot,
                  event: mergedEvent,
                  calendarRowId: rowId,
                  slotSuggestions: mapSuggestionsAfterApprove(slot.slotSuggestions, payload.routineOffOn),
                  routineCardComplete: true,
                },
          )
          return { ...m, multiSlots: nextSlots }
        }),
      )
      onToast('적용했어요')
    } catch (e) {
      onToast(e instanceof Error ? e.message : '처리 실패', false)
    } finally {
      setSuggestionSubmitKey(null)
    }
  }

  const handleUnifiedCancelMulti = async (
    parseMsgId: string,
    slotIndex: number,
    slotSuggestions: SuggestionUi[],
  ) => {
    const pending = pendingSuggestions(slotSuggestions)
    if (pending.length === 0) return
    const key = `${parseMsgId}:${slotIndex}`
    setSuggestionSubmitKey(key)
    try {
      await rejectPendingSuggestionsBatch(pending)
      setMessages((prev) =>
        prev.map((m) => {
          if (m.kind !== 'parse' || m.id !== parseMsgId || !m.multiSlots) return m
          const nextSlots = m.multiSlots.map((slot, j) =>
            j !== slotIndex
              ? slot
              : { ...slot, slotSuggestions: mapSuggestionsAfterRejectAll(slot.slotSuggestions) },
          )
          return { ...m, multiSlots: nextSlots }
        }),
      )
      onToast('취소했어요')
    } catch (e) {
      onToast(e instanceof Error ? e.message : '처리 실패', false)
    } finally {
      setSuggestionSubmitKey(null)
    }
  }

  if (!mounted || typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="routine-agent-chat-panel"
          className="fixed inset-0 z-[150] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* 반투명 배경: 탭하면 패널만 닫힘 */}
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="패널 닫기" onClick={onClose} />
          <motion.aside
            className="absolute inset-y-0 right-0 flex min-h-0 w-[min(100%,24rem)] flex-col overflow-hidden border-l border-gray-200 bg-white shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 상단 바: 파비콘 + 제목 + 닫기(브라우저 탭과 같은 아이콘) */}
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-3 py-3">
              <span className="flex min-w-0 items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- 작은 브랜드 마크(`/assets/**`) */}
                <img
                  src={TOPBAR_LOGO_SRC}
                  alt=""
                  className="h-7 w-7 shrink-0 rounded-lg object-contain"
                />
                <p className="truncate text-sm font-black text-brand-text">루틴 도우미</p>
              </span>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-2 py-1 text-xs font-bold text-gray-600 hover:bg-white/80"
              >
                닫기
              </button>
            </div>

            {/*
              인텐트 상단: 대분류·세부 칩 모두 가로 스크롤(막대 숨김) + 우측 페이드로 더 스크롤됨을 힌트.
              버튼은 shrink-0 로 폭이 줄지 않게 해 키워드가 늘어나도 슬라이드로 탐색합니다.
            */}
            <div className="shrink-0 border-b border-gray-100 bg-white px-3 py-2">
              <p className="mb-1.5 text-[10px] font-bold text-gray-400">무엇을 도와드릴까요?</p>
              <div className="routine-agent-intent-scroll-fade relative">
                <div
                  className="routine-agent-hide-scrollbar flex touch-pan-x gap-2 overflow-x-auto pb-1.5 pt-0.5"
                  role="tablist"
                  aria-label="루틴 도우미 인텐트 카테고리"
                >
                  {INTENT_CATEGORIES.map((cat) => {
                    const selected = cat.id === expandedIntentCategoryId
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        aria-expanded={selected}
                        onClick={() => onIntentCategoryTabClick(cat.id)}
                        className={`shrink-0 rounded-lg border px-3 py-2 text-center text-[10px] font-black leading-tight transition active:scale-[0.98] ${
                          selected ? cat.tabActiveClass : cat.tabInactiveClass
                        }`}
                      >
                        {cat.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {activeIntentCategory ? (
                <div className="routine-agent-intent-scroll-fade relative mt-2">
                  <div
                    className="routine-agent-hide-scrollbar flex touch-pan-x gap-2 overflow-x-auto pb-1 pt-0.5"
                    role="group"
                    aria-label={`${activeIntentCategory.label} 세부 인텐트`}
                  >
                    {activeIntentCategory.intents.map((chip, idx) => {
                      const pair = SUBCHIP_STYLES_BY_CATEGORY[activeIntentCategory.id] ?? [
                        'border-gray-200 bg-gray-50 text-gray-900',
                        'border-gray-200 bg-gray-50 text-gray-900',
                      ]
                      const chipClass = pair[idx % 2] ?? pair[0]
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => pushIntentQuestionSet(chip.prompt)}
                          className={`shrink-0 whitespace-nowrap rounded-xl border px-3 py-2.5 text-center text-[11px] font-black leading-snug shadow-sm transition active:scale-[0.98] ${chipClass}`}
                        >
                          {chip.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <p className="mt-2 rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-2 py-2 text-center text-[10px] font-bold text-gray-400">
                  카테고리를 누르면 세부 선택이 펼쳐져요
                </p>
              )}
            </div>

            {/* 대화창 전체 영역 — 스크롤 배경도 흰색으로 통일(스크롤바는 숨기고 위·아래 스크롤은 그대로) */}
            <div className="routine-agent-hide-scrollbar min-h-0 flex-1 overflow-y-auto bg-white px-3 py-2">
              <ul className="flex flex-col gap-2">
                {messages.map((m) => {
                  if (m.kind === 'text') {
                    const isUser = m.role === 'user'
                    return (
                      <li
                        key={m.id}
                        className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm ${
                            isUser
                              ? 'rounded-br-md bg-pink-100/90 text-gray-900'
                              : 'rounded-bl-md bg-sky-100/90 text-gray-900'
                          }`}
                        >
                          {m.text}
                        </div>
                      </li>
                    )
                  }

                  /* 여러 일정: 1/N 과 등록·건너뛰기·수정 (실제 저장은 commit-schedule API) */
                  if (m.multiSlots && m.multiSlots.length > 0 && m.agentCall) {
                    const idx = m.multiIndex ?? 0
                    const slot = m.multiSlots[idx]
                    const n = m.multiSlots.length
                    const total = m.parseResult.count ?? n
                    const ev = slot.event
                    const wk = weekdayKoFromYmd(ev.start_date)
                    const dateLine = `${ev.start_date}${wk ? ` (${wk})` : ''}`
                    const isEditingThis =
                      multiEdit?.parseMsgId === m.id && multiEdit?.slotIndex === idx
                    const multiTypeOptions = ['school', 'holiday', 'vacation', 'etc', 'travel', 'birthday'] as const
                    return (
                      <li key={m.id} className="flex w-full justify-start">
                        {/*
                          다건 일정 카드: max-w만 두면 flex 안에서 **내용만큼만** 너비가 잡혀 좁아 보임.
                          w-full 로 스크롤 영역(좌우 px-3 안쪽) 가로를 꽉 채워 하단 「직접 입력하기」와 폭을 맞춤.
                        */}
                        <div className="w-full min-w-0 space-y-2 rounded-2xl border border-indigo-100 bg-white p-3 shadow-md ring-1 ring-indigo-50">
                          <p className="text-center text-xs font-black text-indigo-950">{total}개 일정을 찾았어요</p>
                          <div className="flex items-center justify-center gap-2 text-[11px] font-black tabular-nums text-gray-800">
                            <button
                              type="button"
                              disabled={idx <= 0}
                              onClick={() => setMultiIndex(m.id, idx - 1)}
                              className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] disabled:opacity-40"
                            >
                              ◀
                            </button>
                            <span>
                              &lt; {idx + 1} / {n} &gt;
                            </span>
                            <button
                              type="button"
                              disabled={idx >= n - 1}
                              onClick={() => setMultiIndex(m.id, idx + 1)}
                              className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] disabled:opacity-40"
                            >
                              ▶
                            </button>
                          </div>
                          {isEditingThis && multiEdit ? (
                            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/80 p-2">
                              <p className="text-[10px] font-black text-amber-900">일정 수정</p>
                              <input
                                value={multiEdit.title}
                                onChange={(e) => setMultiEdit({ ...multiEdit, title: e.target.value })}
                                className="w-full rounded-lg border border-gray-200 px-2 py-1 text-[11px]"
                                placeholder="제목"
                              />
                              <div className="grid grid-cols-2 gap-1">
                                <input
                                  type="date"
                                  value={multiEdit.start_date}
                                  onChange={(e) => setMultiEdit({ ...multiEdit, start_date: e.target.value })}
                                  className="rounded-lg border border-gray-200 px-1 py-1 text-[10px]"
                                />
                                <input
                                  type="date"
                                  value={multiEdit.end_date}
                                  min={multiEdit.start_date}
                                  onChange={(e) => setMultiEdit({ ...multiEdit, end_date: e.target.value })}
                                  className="rounded-lg border border-gray-200 px-1 py-1 text-[10px]"
                                />
                              </div>
                              <select
                                value={multiEdit.type}
                                onChange={(e) => setMultiEdit({ ...multiEdit, type: e.target.value })}
                                className="w-full rounded-lg border border-gray-200 px-1 py-1 text-[10px]"
                              >
                                {multiTypeOptions.map((t) => (
                                  <option key={t} value={t}>
                                    {agentEventTypeLabel(t)}
                                  </option>
                                ))}
                              </select>
                              <textarea
                                value={multiEdit.description}
                                onChange={(e) => setMultiEdit({ ...multiEdit, description: e.target.value })}
                                rows={2}
                                className="routine-agent-hide-scrollbar w-full resize-none rounded-lg border border-gray-200 px-2 py-1 text-[10px]"
                                placeholder="비고·설명"
                              />
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => applyMultiEdit()}
                                  className="flex-1 rounded-lg bg-amber-600 py-1.5 text-[10px] font-black text-white"
                                >
                                  저장
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setMultiEdit(null)}
                                  className="flex-1 rounded-lg border border-gray-300 bg-white py-1.5 text-[10px] font-bold text-gray-600"
                                >
                                  취소
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1 rounded-xl bg-sky-50/90 px-3 py-2 text-xs text-gray-900 ring-1 ring-sky-100">
                              <p className="font-black text-sky-950">{ev.title || '일정'}</p>
                              <p className="text-[11px] text-gray-700">
                                {dateLine}
                                {ev.end_date && ev.end_date !== ev.start_date ? ` ~ ${ev.end_date}` : ''}
                              </p>
                              <p className="text-[10px] text-gray-600">유형: {agentEventTypeLabel(ev.type)}</p>
                              {ev.description ? (
                                <p className="text-[10px] text-gray-600">메모: {ev.description}</p>
                              ) : null}
                            </div>
                          )}
                          {slot.status === 'pending' && !isEditingThis ? (
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                disabled={loading}
                                onClick={() =>
                                  void handleMultiCommitSlot(m.id, idx, slot, m.agentCall!)
                                }
                                className="min-w-0 flex-1 rounded-xl bg-emerald-500 py-2 text-[10px] font-black text-white shadow active:scale-[0.99] disabled:opacity-50"
                              >
                                등록하기
                              </button>
                              <button
                                type="button"
                                disabled={loading}
                                onClick={() => handleMultiSkipSlot(m.id, idx)}
                                className="min-w-0 flex-1 rounded-xl bg-gray-100 py-2 text-[10px] font-black text-gray-800 active:scale-[0.99] disabled:opacity-50"
                              >
                                건너뛰기
                              </button>
                              <button
                                type="button"
                                disabled={loading}
                                onClick={() => openMultiEdit(m.id, idx, ev)}
                                className="min-w-0 flex-1 rounded-xl border border-sky-300 bg-sky-50 py-2 text-[10px] font-black text-sky-900 active:scale-[0.99] disabled:opacity-50"
                              >
                                수정하기
                              </button>
                            </div>
                          ) : null}
                          {slot.status === 'skipped' ? (
                            <p className="text-center text-[10px] font-bold text-gray-400">건너뛴 일정이에요</p>
                          ) : null}
                          {slot.status === 'committed' && slot.slotSuggestions.length > 0 ? (
                            <UnifiedScheduleConfirmCard
                              key={`${m.id}-${idx}-sug`}
                              layout="compact"
                              event={slot.event}
                              suggestions={slot.slotSuggestions}
                              registrationComplete={Boolean(slot.routineCardComplete)}
                              busy={suggestionSubmitKey === `${m.id}:${idx}` || loading}
                              onRegister={(payload) =>
                                void handleUnifiedRegisterMulti(
                                  m.id,
                                  idx,
                                  payload,
                                  slot.slotSuggestions,
                                  slot.savedEventId ?? null,
                                  slot.calendarRowId ?? null,
                                  slot.event,
                                )
                              }
                              onCancel={() =>
                                void handleUnifiedCancelMulti(m.id, idx, slot.slotSuggestions)
                              }
                            />
                          ) : null}
                          {slot.status === 'committed' && slot.slotSuggestions.length === 0 ? (
                            <p className="text-[10px] text-gray-500">이 일정에 대한 추가 제안이 없어요.</p>
                          ) : null}
                          {m.multiReviewComplete ? (
                            <p className="rounded-xl bg-emerald-50 px-2 py-2.5 text-center text-[11px] font-black text-emerald-900 ring-1 ring-emerald-100">
                              모든 일정 확인 완료!
                            </p>
                          ) : null}
                        </div>
                      </li>
                    )
                  }

                  const ev = m.parseResult.event
                  return (
                    <li key={m.id} className="flex w-full justify-start">
                      {/*
                        단건: 제안이 있으면 통합 카드 하나만(타입 영문 미노출).
                        제안이 없으면 요약만 파스텔 박스로 표시합니다.
                      */}
                      <div className="w-full min-w-0 space-y-2">
                        <UnifiedScheduleConfirmCard
                          key={`${m.id}-sug`}
                          layout="full"
                          event={ev}
                          suggestions={m.suggestions}
                          registrationComplete={Boolean(m.confirmComplete)}
                          busy={suggestionSubmitKey === m.id || loading}
                          onRegister={(payload) =>
                            void handleUnifiedRegisterSingle(
                              m.id,
                              m.suggestions,
                              payload,
                              m.parseResult.saved_event_id ?? null,
                              m.calendarRowId ?? null,
                              m.parseResult.event,
                            )
                          }
                          onCancel={() => void handleUnifiedCancelSingle(m.id, m.suggestions)}
                        />
                      </div>
                    </li>
                  )
                })}
                {loading ? (
                  <li className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-sky-100/80 px-3 py-2 text-xs text-gray-600">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-300 border-t-sky-700" />
                      분석 중…
                    </div>
                  </li>
                ) : null}
              </ul>
              <div ref={listEndRef} />
            </div>

            {/* 하단: 접이식 직접 입력 + 이미지 + 입력창 + 보내기 */}
            <div className="shrink-0 border-t border-gray-100 bg-white px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />

              <button
                type="button"
                onClick={() => setDirectOpen((v) => !v)}
                className="mb-2 flex w-full items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white py-2 text-[11px] font-bold text-gray-700 shadow-sm"
                aria-expanded={directOpen}
              >
                직접 입력하기
                <span className="text-gray-400" aria-hidden>
                  {directOpen ? '⌃' : '∨'}
                </span>
              </button>

              {directOpen ? (
                <div className="mb-3 space-y-2 rounded-xl border border-gray-100 bg-white p-3 shadow-inner">
                  <div>
                    <label className="mb-0.5 block text-[10px] font-bold text-gray-500">일정 이름</label>
                    <input
                      value={dTitle}
                      onChange={(e) => setDTitle(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                      placeholder="예: 여름방학"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-0.5 block text-[10px] font-bold text-gray-500">시작일</label>
                      <input
                        type="date"
                        value={dStart}
                        onChange={(e) => setDStart(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-1 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[10px] font-bold text-gray-500">종료일</label>
                      <input
                        type="date"
                        value={dEnd}
                        min={dStart}
                        onChange={(e) => setDEnd(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-1 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-bold text-gray-500">이벤트 종류</p>
                    <div className="grid grid-cols-2 gap-1">
                      {EVENT_TYPES_ORDER.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setDType(type)}
                          className={`rounded-lg border py-1.5 text-[10px] font-bold ${
                            dType === type ? 'border-brand-blue bg-brand-blue/10 text-brand-blue' : 'border-gray-200 text-gray-400'
                          }`}
                        >
                          {EVENT_TYPE_LABELS[type]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-bold text-gray-500">루틴 적용</p>
                    <div className="flex gap-1">
                      {(['weekend', 'none'] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setDOverride(v)}
                          className={`flex-1 rounded-lg border py-1.5 text-[10px] font-bold ${
                            dOverride === v ? 'border-brand-blue bg-brand-blue/10 text-brand-blue' : 'border-gray-200 text-gray-400'
                          }`}
                        >
                          {v === 'weekend' ? '휴일 루틴 적용' : '미션 없음'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] font-bold text-gray-500">간단한 설명</label>
                    <textarea
                      value={dDesc}
                      onChange={(e) => setDDesc(e.target.value)}
                      rows={2}
                      className="routine-agent-hide-scrollbar w-full resize-none rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={loading || !dTitle.trim()}
                    onClick={() => void handleDirectSave()}
                    className="w-full rounded-xl bg-brand-blue py-2.5 text-xs font-black text-white shadow disabled:opacity-50"
                  >
                    저장
                  </button>
                </div>
              ) : null}

              <div className="mb-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="shrink-0 rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-2 text-[10px] font-black leading-tight text-sky-900 shadow-sm active:scale-[0.98]"
                  aria-label="이미지 첨부"
                >
                  사진
                </button>
                <textarea
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  rows={2}
                  placeholder="메시지를 입력하세요"
                  className="routine-agent-hide-scrollbar min-h-0 flex-1 resize-none rounded-xl border border-gray-200 bg-white px-2 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                />
              </div>
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element -- 로컬 미리보기
                <img src={imagePreview} alt="" className="mb-2 max-h-24 w-full rounded-lg object-contain ring-1 ring-sky-100" />
              ) : null}
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleSendComposer()}
                className="w-full rounded-xl bg-gradient-to-r from-rose-300 to-sky-400 py-3 text-xs font-black text-white shadow-md disabled:opacity-50"
              >
                보내기
              </button>
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
