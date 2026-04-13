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

import { useCallback, useEffect, useId, useRef, useState } from 'react'
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
  agentParseTypeToLocalEventType,
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
    if (!s.suggestion_id) return { ...s, status: 'rejected' as const }
    if (isRoutineOffSuggestion(s)) return { ...s, status: routineOffOn ? 'approved' : 'rejected' }
    return { ...s, status: 'approved' as const }
  })
}

function mapSuggestionsAfterRejectAll(suggestions: SuggestionUi[]): SuggestionUi[] {
  return suggestions.map((s) => (s.status === 'pending' ? { ...s, status: 'rejected' as const } : s))
}

/** 확인 카드 [등록하기] 시 부모가 로컬 캘린더·제안 승인에 함께 넘길 값 */
type ScheduleConfirmRegisterPayload = {
  routineOffOn: boolean
  eventType: LocalCalendarEvent['eventType']
  description: string
}

/**
 * 유형 키워드 칩 한 종류 — 화면에는 짧은 한글 라벨, 저장에는 `eventType` 만 씁니다.
 * (같은 `eventType` 이라도 부모가 구분하기 쉽게 라벨을 나눴습니다.)
 */
type ScheduleKeywordChipId = 'school' | 'public' | 'vacation' | 'trip' | 'anniv' | 'other'

const SCHEDULE_KEYWORD_CHIPS: {
  id: ScheduleKeywordChipId
  label: string
  eventType: LocalCalendarEvent['eventType']
}[] = [
  { id: 'school', label: '학교·행사', eventType: 'other' },
  { id: 'public', label: '공휴일', eventType: 'holiday' },
  { id: 'vacation', label: '방학·돌봄', eventType: 'vacation' },
  { id: 'trip', label: '가족여행', eventType: 'vacation' },
  { id: 'anniv', label: '기념일', eventType: 'special' },
  { id: 'other', label: '기타', eventType: 'other' },
]

/**
 * 제목·설명·에이전트 유형을 읽어 **처음에 어떤 키워드 칩을 켤지** 추측합니다.
 * - 예: 글에 ‘방학’이 있으면 방학·돌봄 칩, ‘체육대회’면 학교·행사 칩을 우선합니다.
 */
function inferScheduleKeywordChipId(ev: AgentParseEvent): ScheduleKeywordChipId {
  const blob = `${ev.title ?? ''} ${ev.description ?? ''}`
  const t = (ev.type || '').trim().toLowerCase()

  if (t === 'school' || /학교|체육대회|현장학습|수련회|알림장|학부모|세례식/.test(blob)) return 'school'
  if (t === 'holiday' || /공휴|대체공휴|설날|추석|신정|휴일|연휴/.test(blob)) return 'public'
  if (t === 'vacation' || /방학|돌봄|여름방학|겨울방학/.test(blob)) return 'vacation'
  if (t === 'travel' || /여행|캠핑|패키지|출국|해외/.test(blob)) return 'trip'
  if (t === 'birthday' || /생일|돌잔치|기념일|졸업식|입학식/.test(blob)) return 'anniv'

  const mapped = agentParseTypeToLocalEventType(ev.type)
  const byType = SCHEDULE_KEYWORD_CHIPS.find((c) => c.eventType === mapped)
  return byType?.id ?? 'other'
}

/**
 * 통합 등록 카드 — 일정 요약 + 유형 키워드 칩 + 설명 입력 + 간단 루틴 on/off + 등록/취소.
 * - `layout="full"`: 단건 파싱 직후, 제목·날짜까지 카드 안에 표시
 * - `layout="compact"`: 다건에서 위쪽 박스에 일정이 있으므로 루틴·유형 위주로만 표시
 */
function UnifiedScheduleConfirmCard(props: {
  layout: 'full' | 'compact'
  event: AgentParseEvent
  suggestions: SuggestionUi[]
  busy: boolean
  onRegister: (payload: ScheduleConfirmRegisterPayload) => void | Promise<void>
  onCancel: () => void | Promise<void>
}) {
  const { layout, event: ev, suggestions, busy, onRegister, onCancel } = props
  const descFieldId = useId()
  const pending = pendingSuggestions(suggestions)
  const showRoutineToggle = pending.some((s) => isRoutineOffSuggestion(s))
  /** routine_off 제안이 있으면 처음부터 ON */
  const [routineOffOn, setRoutineOffOn] = useState(() => pending.some((s) => isRoutineOffSuggestion(s)))
  /** 부모가 고른 유형 키워드(칩 하나만 선택) */
  const [keywordId, setKeywordId] = useState<ScheduleKeywordChipId>(() => inferScheduleKeywordChipId(ev))
  /** 사용자가 고칠 수 있는 설명 — 처음엔 AI가 넣은 설명을 그대로 둡니다 */
  const [descriptionDraft, setDescriptionDraft] = useState(() => ev.description ?? '')

  /** 같은 말풍선 안에서 AI가 새 `event` 를 주면 키워드·설명만 초기화합니다 */
  useEffect(() => {
    setKeywordId(inferScheduleKeywordChipId(ev))
    setDescriptionDraft(ev.description ?? '')
  }, [ev.title, ev.type, ev.start_date, ev.end_date, ev.description])

  /** 제안 목록이 바뀌면(새 파싱 등) 루틴 끄기 스위치 기본값을 다시 맞춥니다 */
  useEffect(() => {
    const pend = suggestions.filter((s) => s.status === 'pending')
    setRoutineOffOn(pend.some((s) => isRoutineOffSuggestion(s)))
  }, [suggestions])

  const wk = weekdayKoFromYmd(ev.start_date)
  const dateLine = `${ev.start_date}${wk ? ` (${wk})` : ''}`
  const dateRange =
    ev.end_date && ev.end_date !== ev.start_date ? `${dateLine} ~ ${ev.end_date}` : dateLine

  const selectedEventType =
    SCHEDULE_KEYWORD_CHIPS.find((c) => c.id === keywordId)?.eventType ?? ('other' as const)

  if (pending.length === 0) {
    if (suggestions.length === 0) return null
    return (
      <div className="rounded-2xl border border-violet-100/90 bg-gradient-to-b from-violet-50/90 to-sky-50/70 px-3 py-3 text-center shadow-sm ring-1 ring-violet-100/50">
        <p className="text-[11px] font-bold text-violet-900">✓ 일정을 등록했어요</p>
      </div>
    )
  }

  const heading = layout === 'full' ? '일정을 등록할까요?' : '이 일정의 루틴을 적용할까요?'

  return (
    <div className="rounded-2xl border border-violet-100/90 bg-gradient-to-b from-violet-50/90 via-white to-sky-50/80 p-3 shadow-md ring-1 ring-sky-100/60">
      <p className="text-center text-xs font-black text-violet-950">{heading}</p>
      {layout === 'full' ? (
        <div className="mt-2 space-y-1 text-xs text-gray-900">
          <p className="font-black text-gray-900">{ev.title || '일정'}</p>
          <p className="text-[11px] text-gray-700">{dateRange}</p>
        </div>
      ) : (
        <p className="mt-1.5 text-center text-[10px] font-bold text-gray-500">
          유형·설명을 손볼 수 있어요. 등록하면 루틴 제안도 함께 반영돼요.
        </p>
      )}

      {/* 유형: 탭할 수 있는 키워드 칩 — 한 번에 하나만 선택 */}
      <div className={layout === 'full' ? 'mt-3' : 'mt-2'}>
        <p className="mb-1.5 text-[10px] font-bold text-gray-500">유형 키워드</p>
        <div className="flex flex-wrap gap-1.5">
          {SCHEDULE_KEYWORD_CHIPS.map((chip) => {
            const on = chip.id === keywordId
            return (
              <button
                key={chip.id}
                type="button"
                disabled={busy}
                onClick={() => setKeywordId(chip.id)}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-black transition ${
                  on
                    ? 'border-violet-400 bg-violet-500 text-white shadow-sm'
                    : 'border-gray-200 bg-white text-gray-600 active:scale-[0.98]'
                } disabled:opacity-50`}
              >
                {chip.label}
              </button>
            )
          })}
        </div>
        <p className="mt-1 text-[9px] text-gray-400">내용을 바탕으로 위 키워드를 자동 골라 두었어요. 필요하면 눌러 바꿀 수 있어요.</p>
      </div>

      {/* 설명: 부모가 직접 적는 칸 */}
      <div className="mt-2.5">
        <label className="mb-1 block text-[10px] font-bold text-gray-500" htmlFor={descFieldId}>
          설명(선택)
        </label>
        <textarea
          id={descFieldId}
          disabled={busy}
          value={descriptionDraft}
          onChange={(e) => setDescriptionDraft(e.target.value)}
          rows={layout === 'full' ? 3 : 2}
          placeholder="예: 준비물, 장소, 시간 등 메모해 두세요"
          className="routine-agent-hide-scrollbar w-full resize-none rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-[11px] leading-relaxed text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-blue/25 disabled:opacity-50"
        />
      </div>

      {/* 루틴: 캘린더 시트와 비슷한 한 줄 토글 — 큰 박스 없이 */}
      {showRoutineToggle ? (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-2.5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-gray-800">이날 루틴 끄기</p>
            <p className="text-[9px] font-medium text-gray-400">
              {routineOffOn ? '미션·루틴을 쉬게 해요' : '휴일 루틴을 유지해요'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={routineOffOn}
            disabled={busy}
            onClick={() => setRoutineOffOn((v) => !v)}
            className={`relative h-7 w-12 shrink-0 rounded-full border-2 transition ${
              routineOffOn
                ? 'border-emerald-400 bg-emerald-100 shadow-inner'
                : 'border-gray-200 bg-gray-100'
            } disabled:opacity-50`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                routineOffOn ? 'left-[calc(100%-1.35rem)]' : 'left-0.5'
              }`}
            />
            <span className="sr-only">이날 루틴 끄기 {routineOffOn ? '켜짐' : '꺼짐'}</span>
          </button>
        </div>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void onRegister({
              routineOffOn,
              eventType: selectedEventType,
              description: descriptionDraft,
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
      /** 단건 파싱: 서버 초안과 동일 일정을 부모 캘린더(localStorage)에도 반영 */
      if (!isMulti) {
        syncAgentEventToLocalCalendar(childId, res.event, res.saved_event_id ?? null)
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

  /** 직접 입력 폼 [저장] — 내용을 글로 합쳐 parse 로 보냅니다(로컬 캘린더에는 저장하지 않음) */
  const handleDirectSave = async () => {
    if (!dTitle.trim()) {
      onToast('일정 이름을 입력해 주세요', false)
      return
    }
    if (!familyLinkId || !childId) {
      onToast('가족 연결 정보를 찾을 수 없어요. 잠시 후 다시 시도해 주세요.', false)
      return
    }
    const block = [
      '[직접 입력 일정]',
      `일정 이름: ${dTitle.trim()}`,
      `시작일: ${dStart}`,
      `종료일: ${dEnd}`,
      `이벤트 종류: ${EVENT_TYPE_LABELS[dType]}`,
      `루틴 적용: ${dOverride === 'weekend' ? '휴일 루틴 적용' : '미션 없음'}`,
      dDesc.trim() ? `설명: ${dDesc.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    setMessages((prev) => [...prev, { id: newId(), kind: 'text', role: 'user', text: block }])
    await runParse({
      family_link_id: familyLinkId,
      child_id: childId,
      input_type: 'text',
      text_input: block,
    })
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
      syncAgentEventToLocalCalendar(childId, out.event, out.saved_event_id ?? null)
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
      if (!s.suggestion_id) {
        onToast('연결되지 않은 제안이 있어 건너뛰었어요. 에이전트를 최신으로 배포했는지 확인해 주세요.', false)
        continue
      }
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
  ) => {
    const pending = pendingSuggestions(suggestions)
    if (pending.length === 0) return
    setSuggestionSubmitKey(parseMsgId)
    try {
      /** 로컬 캘린더(달력 점)에 반영된 행을 부모가 고친 유형·설명·루틴으로 맞춤 */
      patchLocalCalendarEventInStorage(savedCalendarEventId, {
        eventType: payload.eventType,
        description: payload.description,
        routineOverride: payload.routineOffOn ? 'none' : 'weekend',
      })
      await approvePendingSuggestionsBatch(pending, payload.routineOffOn)
      setMessages((prev) =>
        prev.map((m) =>
          m.kind === 'parse' && m.id === parseMsgId
            ? { ...m, suggestions: mapSuggestionsAfterApprove(m.suggestions, payload.routineOffOn) }
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
    if (pending.length === 0) return
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
  ) => {
    const pending = pendingSuggestions(slotSuggestions)
    if (pending.length === 0) return
    const key = `${parseMsgId}:${slotIndex}`
    setSuggestionSubmitKey(key)
    try {
      patchLocalCalendarEventInStorage(savedCalendarEventId, {
        eventType: payload.eventType,
        description: payload.description,
        routineOverride: payload.routineOffOn ? 'none' : 'weekend',
      })
      await approvePendingSuggestionsBatch(pending, payload.routineOffOn)
      setMessages((prev) =>
        prev.map((m) => {
          if (m.kind !== 'parse' || m.id !== parseMsgId || !m.multiSlots) return m
          const nextSlots = m.multiSlots.map((slot, j) =>
            j !== slotIndex
              ? slot
              : {
                  ...slot,
                  slotSuggestions: mapSuggestionsAfterApprove(slot.slotSuggestions, payload.routineOffOn),
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
                          <p className="text-center text-xs font-black text-indigo-950">
                            📋 {total}개 일정을 찾았어요!
                          </p>
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
                                📅 {dateLine}
                                {ev.end_date && ev.end_date !== ev.start_date ? ` ~ ${ev.end_date}` : ''}
                              </p>
                              <p className="text-[10px] text-gray-600">
                                🏷 {agentEventTypeLabel(ev.type)}
                              </p>
                              {ev.description ? (
                                <p className="text-[10px] text-gray-600">📝 {ev.description}</p>
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
                              busy={suggestionSubmitKey === `${m.id}:${idx}` || loading}
                              onRegister={(payload) =>
                                void handleUnifiedRegisterMulti(
                                  m.id,
                                  idx,
                                  payload,
                                  slot.slotSuggestions,
                                  slot.savedEventId ?? null,
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
                  const evWk = weekdayKoFromYmd(ev.start_date)
                  const evDateLine = `${ev.start_date}${evWk ? ` (${evWk})` : ''}`
                  return (
                    <li key={m.id} className="flex w-full justify-start">
                      {/*
                        단건: 제안이 있으면 통합 카드 하나만(타입 영문 미노출).
                        제안이 없으면 요약만 파스텔 박스로 표시합니다.
                      */}
                      <div className="w-full min-w-0 space-y-2">
                        {m.suggestions.length > 0 ? (
                          <UnifiedScheduleConfirmCard
                            key={`${m.id}-sug`}
                            layout="full"
                            event={ev}
                            suggestions={m.suggestions}
                            busy={suggestionSubmitKey === m.id || loading}
                            onRegister={(payload) =>
                              void handleUnifiedRegisterSingle(
                                m.id,
                                m.suggestions,
                                payload,
                                m.parseResult.saved_event_id ?? null,
                              )
                            }
                            onCancel={() => void handleUnifiedCancelSingle(m.id, m.suggestions)}
                          />
                        ) : (
                          <div className="rounded-2xl border border-sky-100 bg-sky-50/85 px-3 py-2.5 text-xs leading-relaxed text-gray-900 shadow-sm ring-1 ring-sky-100/60">
                            <p className="font-black text-sky-950">분석된 일정</p>
                            <p className="mt-1 font-bold">{ev.title || '일정'}</p>
                            <p className="mt-0.5 text-[10px] text-gray-600">
                              📅 {evDateLine}
                              {ev.end_date && ev.end_date !== ev.start_date ? ` ~ ${ev.end_date}` : ''}
                            </p>
                            <p className="mt-0.5 text-[10px] text-gray-600">유형: {agentEventTypeLabel(ev.type)}</p>
                            {ev.description ? (
                              <p className="mt-1 text-[10px] text-gray-600">📝 {ev.description}</p>
                            ) : null}
                            <p className="mt-2 text-[10px] font-bold text-gray-400">추가 제안이 없어요.</p>
                          </div>
                        )}
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
                  className="shrink-0 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-lg leading-none text-sky-800 shadow-sm active:scale-[0.98]"
                  aria-label="이미지 첨부"
                >
                  🖼
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
