'use client'
import ParentChevron from '@/components/parent/ParentChevron'

/**
 * 루틴 탭 — 우측 하단에서 열리는 「챗봇」슬라이딩 패널입니다.
 * - Framer Motion 으로 오른쪽에서 패널이 들어옵니다. 패널·대화 스크롤 영역 배경은 흰색으로 통일합니다.
 * - 홈(STEP 0): 인사 + 「일정 등록」「루틴 관리」카드. 일정 등록은 메뉴→텍스트/이미지/빠른 키워드(칩 누르면 **별도 폼 없이** 채팅에 확인 카드가 바로 붙음)로 나뉘며, 루틴 관리는 탭+주간 루틴 위저드로 `RoutineKeywordBuilderSheet`·`SpecialMissionAddSheet` 를 embedded 재사용합니다.
 * - 가로·세로 스크롤 **막대(슬라이드 바)** 는 `globals.css` 의 `.routine-agent-hide-scrollbar` 로 숨기되, 스크롤 동작은 그대로 둡니다.
 * - 부모 탭 `<main>` 이 스크롤 컨테이너라 막대가 오버레이 위에 겹칠 수 있어, 열릴 때 `overflow` 를 잠그고 z-index 를 시트들보다 높입니다.
 * - 텍스트·이미지는 `/agent-b/parse` 로 보냅니다. 한 건만 나오면 곧바로 DB 초안 + 제안이 붙고, 여러 건이면 `< 1/N >` 로 한 줄씩 확인한 뒤 [등록] 시 `/agent-b/commit-schedule` 로 저장합니다.
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
  AgentParseRequestError,
  type AgentParseApiRow,
  type AgentParseEvent,
  type AgentParseResponse,
  type AgentParsedScheduleRow,
  type AgentParseSuggestion,
} from '@/lib/agentApi'
import { getSeoulDateString } from '@/lib/koreaDate'
import { PARENT_TABS_MAIN_SCROLL_EL_ID } from '@/lib/parentTabsMainScrollId'
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
  classifyTextBeforeApi,
  localBuiltScheduleFromParentForm,
  normalizeAgentTypeForPicker,
  shouldCallAPI,
} from '@/lib/routineAgentLocalParse'
import {
  patchLocalCalendarEventInStorage,
  rewriteLocalCalendarEventIdInStorage,
  shouldSkipSyncAgentEvent,
  syncAgentEventToLocalCalendar,
} from '@/lib/syncAgentEventToLocalCalendar'
import { enrichAgentParseResponseWithHolidayRoutineOff } from '@/lib/publicHolidaysRoutineOff'
import { routineAgentImageParseAssistantMessage } from '@/lib/routineAgentImageParseErrors'
import type { LocalCalendarEvent, Mission } from '@/types/database'
import RoutineKeywordBuilderSheet, {
  type RoutinePanelWizardStep,
} from '@/components/parent/RoutineKeywordBuilderSheet'
import SpecialMissionAddSheet from '@/components/parent/SpecialMissionAddSheet'

type Props = {
  open: boolean
  onClose: () => void
  familyLinkId: string | null
  childId: string | null
  /** 루틴 관리 탭 — 키워드 시트와 동일 스냅샷(없으면 빈 배열) */
  routineMissions?: Mission[]
  specialMissions?: Mission[]
  hasSchool?: boolean
  onToast: (msg: string, ok?: boolean, multiline?: boolean) => void
  /**
   * 패널이 닫혀 있는 동안 AI 분석(parse)·다건 일정 커밋 등 **새 답장**이 도착했을 때만 호출됩니다.
   * 부모 탭에서 플로팅 버튼 배지 숫자를 올릴 때 씁니다.
   */
  onAssistantRepliesWhileClosed?: (count: number) => void
  /** 패널이 열릴 때마다 호출 — 미읽음 배지를 0으로 돌릴 때 사용합니다 */
  onPanelOpened?: () => void
  /** 홈 탭에서는 루틴 관리 진입을 숨기고 일정 등록 흐름만 노출합니다. */
  showRoutineManageEntry?: boolean
}

/** 예전 버전에서 넣었던 안내 말풍선 — 스텝 UI로 바뀐 뒤에는 목록에서 숨깁니다 */
const LEGACY_SCHEDULE_INTRO = `날짜와 일정 내용을 입력하시거나
학사일정표 사진을 올려주세요.

예) '4월 25일 체육대회'
    '다음주 토요일 가족여행'`

/** 루틴도우미 대화 내역 자동 리셋 시간(1시간) */
const CHAT_HISTORY_RESET_MS = 60 * 60 * 1000

/** 패널 상단 스텝 — 홈 / 일정 등록 분기 / 루틴 관리 */
type AgentPanelShell =
  | 'welcome'
  | 'schedule_menu'
  | 'schedule_text'
  | 'chat'
  | 'schedule_image'
  | 'routine_manage'

/** 빠른 입력 칩 → 에이전트 event_type 및 폼 기본값 */
type KeywordPresetId = 'holiday' | 'travel' | 'event' | 'education' | 'health' | 'etc'

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
  /** 다건 슬롯에서 [취소]로 닫은 카드인지 */
  routineCardCancelled?: boolean
  /** 법정 공휴일과 겹쳐 자동 휴일 처리된 슬롯인지 */
  holidayAutoFromPublic?: boolean
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
  /** 단건에서 [취소]로 카드 닫힘 처리했는지 */
  confirmCancelled?: boolean
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
    saved_event_id:
      raw.saved_event_id ??
      (raw as { savedEventId?: string | null }).savedEventId ??
      null,
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
  categoryMain?: string
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
  /** 부모가 [취소] 처리로 카드를 닫았을 때 보여 줄 문구 */
  cancelledComplete?: boolean
  /** 법정 공휴일(`public_holidays`)과 겹쳐 휴일·루틴 끔을 자동 적용한 경우 안내 문구 */
  showPublicHolidayAutoBanner?: boolean
  /**
   * 빠른 키워드 칩으로 채팅에 붙인 일정일 때 true 입니다.
   * 비개발자 설명: 별도 팝업에서 이름을 치지 않아도, 확인 카드에서 바로 제목을 고칠 수 있게 제목 칸이 열려 있습니다.
   */
  autoEditTitleOnMount?: boolean
  onRegister: (payload: ScheduleConfirmRegisterPayload) => void | Promise<void>
  onCancel: () => void | Promise<void>
}) {
  const {
    layout,
    event: ev,
    suggestions,
    busy,
    registrationComplete,
    cancelledComplete,
    showPublicHolidayAutoBanner,
    autoEditTitleOnMount = false,
    onRegister,
    onCancel,
  } = props
  const descFieldId = useId()
  const pending = pendingSuggestions(suggestions)

  const [titleDraft, setTitleDraft] = useState(() => (ev.title || '일정').trim())
  /** `autoEditTitleOnMount` 이면 마운트 직후 제목을 바로 수정할 수 있게 입력칸을 켭니다 */
  const [editingTitle, setEditingTitle] = useState(() => Boolean(autoEditTitleOnMount))
  const [startIso, setStartIso] = useState(() => (ev.start_date || '').trim() || getSeoulDateString())
  const [endIso, setEndIso] = useState(() => {
    const e = (ev.end_date && String(ev.end_date).trim()) || ''
    const s = (ev.start_date || '').trim() || getSeoulDateString()
    return e || s
  })
  const [agentCode, setAgentCode] = useState(() => normalizeAgentTypeForPicker(ev.type))
  /** 일정 등록 카드에서는 루틴을 별도로 바꾸지 않습니다. 날짜 상세의 두 가지 설정이 유일한 기준입니다. */
  const routineOffOn = false
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
    /** 빠른 칩으로 연 제목 편집 모드는 유지하고, 그 외에는 접습니다 */
    if (!autoEditTitleOnMount) setEditingTitle(false)
    setOpenPicker(null)
  }, [ev.title, ev.type, ev.start_date, ev.end_date, ev.description, ev.routine_off, autoEditTitleOnMount])

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

  if (cancelledComplete) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50/90 px-3 py-2.5 text-center shadow-sm ring-1 ring-gray-100">
        <p className="text-[10px] font-bold text-gray-600">취소된 일정입니다</p>
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
      {showPublicHolidayAutoBanner ? (
        <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-center text-[10px] font-black leading-snug text-red-800 ring-1 ring-red-100">
          공휴일로 자동 설정됐어요
        </p>
      ) : null}
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
              categoryMain: ev.category_main,
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

/** 키워드 칩에 보이는 한글 제목 */
function keywordPresetLabel(id: KeywordPresetId): string {
  const map: Record<KeywordPresetId, string> = {
    holiday: '공휴일',
    travel: '여행',
    event: '행사',
    education: '교육',
    health: '건강',
    etc: '기타',
  }
  return map[id]
}

/** 로컬 캘린더 타입 — `localBuiltScheduleFromParentForm` 과 맞춥니다 */
function keywordToCalendarType(id: KeywordPresetId): LocalCalendarEvent['eventType'] {
  switch (id) {
    case 'event':
      return 'event'
    case 'holiday':
      return 'holiday'
    case 'travel':
      return 'travel'
    case 'education':
      return 'school'
    case 'health':
      return 'etc'
    case 'etc':
    default:
      return 'other'
  }
}

export default function RoutineAgentSchedulePanel({
  open,
  onClose,
  familyLinkId,
  childId,
  routineMissions = [],
  specialMissions = [],
  hasSchool = false,
  onToast,
  onAssistantRepliesWhileClosed,
  onPanelOpened,
  showRoutineManageEntry = true,
}: Props) {
  const [mounted, setMounted] = useState(false)
  /** 채팅 말풍선 목록(위에서 아래로 시간 순) */
  const [messages, setMessages] = useState<ChatMessage[]>([])
  /** 하단 입력창 — 사용자가 직접 타이핑하는 내용 */
  const [composerText, setComposerText] = useState('')
  /** 이미지 미리보기(data URL)와 서버용 base64(접두사 제거) */
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  /** OCR/파싱 실패 시 텍스트 입력으로 자연스럽게 이어주기 위한 안내 표시 상태 */
  const [imageFallbackPending, setImageFallbackPending] = useState(false)
  const [loading, setLoading] = useState(false)
  /** 통합 제안 카드에서 POST /agent-b/approve 연속 호출 중 — `parseMsgId` 또는 `parseMsgId:slotIndex` */
  const [suggestionSubmitKey, setSuggestionSubmitKey] = useState<string | null>(null)
  /** 홈 / 일정 스텝 / 루틴 관리 */
  const [shell, setShell] = useState<AgentPanelShell>('welcome')
  /** 루틴 관리 — 주간 루틴 vs 스페셜 미션 */
  const [routineSubTab, setRoutineSubTab] = useState<'routine' | 'special'>('routine')
  /** 주간 루틴 탭 안 단계(위저드) — `RoutineKeywordBuilderSheet` 와 동기 */
  const [weeklyWizardStep, setWeeklyWizardStep] = useState<RoutinePanelWizardStep>('route')
  /**
   * 빠른 입력 칩으로 만든 파싱 말풍선 id 모음(ref) — 확인 카드에만 쓰며 리렌더는 `messages` 갱신으로 충분합니다.
   * 비개발자 설명: 칩으로 넣은 일정은 처음부터 제목을 고칠 수 있게 입력칸이 열려 있어야 해서 id 를 표시해 둡니다.
   */
  const quickChipParseMessageIdsRef = useRef<Set<string>>(new Set())
  /**
   * 방금 칩으로 붙인 확인 카드를 잠깐 강조(테두리)하고 스크롤을 맞출 때 쓰는 id 입니다.
   * 몇 초 뒤 null 로 돌려도, 제목 자동 편집은 위 ref 로 계속 구분합니다.
   */
  const [emphasizedParseMessageId, setEmphasizedParseMessageId] = useState<string | null>(null)
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
  const fileCameraRef = useRef<HTMLInputElement>(null)
  const fileGalleryRef = useRef<HTMLInputElement>(null)
  const listEndRef = useRef<HTMLDivElement>(null)
  /** 비동기(parse)가 끝날 때 패널이 열려 있는지 — 닫힌 뒤 완료되면 미읽음만 올립니다 */
  const openRef = useRef(open)
  /** 마지막 대화 활동 시각(말풍선/입력/스텝 변화 등) */
  const chatLastActiveAtRef = useRef<number>(Date.now())
  /** 1시간 경과 시 대화를 비우는 타이머 핸들 */
  const chatResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
    setImageFallbackPending(false)
    setLoading(false)
    if (fileCameraRef.current) fileCameraRef.current.value = ''
    if (fileGalleryRef.current) fileGalleryRef.current.value = ''
    setShell('welcome')
    setRoutineSubTab('routine')
    setWeeklyWizardStep('route')
    quickChipParseMessageIdsRef.current.clear()
    setEmphasizedParseMessageId(null)
    setMultiEdit(null)
  }, [])

  /**
   * 1시간 타이머를 다시 걸어, 시간이 지나면 대화를 자동으로 초기화합니다.
   * - 기존 타이머가 있으면 지우고 다시 시작합니다.
   */
  const scheduleChatResetTimer = useCallback(() => {
    if (chatResetTimerRef.current) clearTimeout(chatResetTimerRef.current)
    const elapsed = Date.now() - chatLastActiveAtRef.current
    const remain = Math.max(0, CHAT_HISTORY_RESET_MS - elapsed)
    chatResetTimerRef.current = setTimeout(() => {
      resetAll()
      chatLastActiveAtRef.current = Date.now()
    }, remain)
  }, [resetAll])

  /**
   * `childId` / `familyLinkId` 가 바뀌면 이전 아이와의 대화를 지우고 웰컴(카드) 화면으로 돌립니다.
   * (같은 아이로 루틴 탭을 벗어났다가 돌아오면 컴포넌트가 다시 마운트되면서 ref 가 초기화될 수 있어,
   *  그때도 한 번 초기화가 붙을 수 있습니다 — 의도된 “새 세션” 동작에 가깝습니다.)
   */
  useEffect(() => {
    if (!childId || !familyLinkId) return
    const scope = `${familyLinkId}:${childId}`
    if (agentSessionScopeRef.current === scope) return
    agentSessionScopeRef.current = scope
    resetAll()
    chatLastActiveAtRef.current = Date.now()
    scheduleChatResetTimer()
  }, [childId, familyLinkId, resetAll, scheduleChatResetTimer])

  /**
   * 대화·입력 상태가 바뀌면 "활동 중"으로 보고 1시간 카운트를 다시 시작합니다.
   * 비개발자: 채팅을 계속 쓰는 동안은 초기화되지 않고, 1시간 비활동일 때만 리셋됩니다.
   */
  useEffect(() => {
    chatLastActiveAtRef.current = Date.now()
    scheduleChatResetTimer()
  }, [messages, composerText, imagePreview, imageBase64, shell, scheduleChatResetTimer])

  useEffect(() => {
    if (shell !== 'schedule_image') setImageFallbackPending(false)
  }, [shell])

  /**
   * 닫아 둔 상태에서 시간이 지났을 수 있으므로, 다시 열 때 만료 여부를 한 번 더 확인합니다.
   */
  useEffect(() => {
    if (!open) return
    const elapsed = Date.now() - chatLastActiveAtRef.current
    if (elapsed >= CHAT_HISTORY_RESET_MS) {
      resetAll()
      chatLastActiveAtRef.current = Date.now()
    }
    scheduleChatResetTimer()
  }, [open, resetAll, scheduleChatResetTimer])

  /** 컴포넌트가 사라질 때 타이머를 정리해 메모리 누수를 막습니다. */
  useEffect(() => {
    return () => {
      if (chatResetTimerRef.current) clearTimeout(chatResetTimerRef.current)
    }
  }, [childId, familyLinkId, resetAll])

  /** 패널이 닫혀 있는 동안 새 AI 답장이 생기면 부모에게 숫자만 넘깁니다 */
  const bumpUnreadIfClosed = useCallback(
    (delta: number) => {
      if (delta < 1) return
      if (!openRef.current) onAssistantRepliesWhileClosed?.(delta)
    },
    [onAssistantRepliesWhileClosed],
  )

  /**
   * 일정 등록 메뉴의 「빠른 입력」칩을 눌렀을 때 — 별도 폼 없이 채팅에 확인 카드를 바로 붙입니다.
   * 기본 제목은 칩 라벨(행사·여행 등), 날짜는 오늘(서울), 루틴 on/off 는 프리셋 기본값을 씁니다.
   */
  const appendQuickKeywordPresetToChat = useCallback(
    (preset: KeywordPresetId) => {
      if (!familyLinkId || !childId) {
        onToast('가족 연결 정보를 찾을 수 없어요. 잠시 후 다시 시도해 주세요.', false)
        return
      }
      const today = getSeoulDateString()
      const title = keywordPresetLabel(preset)
      const built = localBuiltScheduleFromParentForm({
        title,
        start_date: today,
        end_date: today,
        calendarEventType: keywordToCalendarType(preset),
        routine_off: false,
        note: '',
      })
      if (!built) {
        onToast('날짜를 준비하는 데 문제가 있어요. 잠시 후 다시 시도해 주세요.', false)
        return
      }
      const res = buildAgentParseResponseFromLocal(built)
      if (res.event) res.event = { ...res.event, category_main: keywordPresetLabel(preset) }
      const sug: SuggestionUi[] = (res.suggestions ?? []).map((s) => ({ ...s, status: 'pending' as const }))
      const parseMsgId = newId()
      quickChipParseMessageIdsRef.current.add(parseMsgId)
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          kind: 'text',
          role: 'user',
          text: `[${keywordPresetLabel(preset)}] ${title}`,
        },
        {
          id: parseMsgId,
          kind: 'parse',
          role: 'assistant',
          parseResult: res,
          suggestions: sug,
          deferCalendarSync: true,
          calendarRowId: null,
        },
      ])
      setEmphasizedParseMessageId(parseMsgId)
      bumpUnreadIfClosed(1)
      setShell('chat')
    },
    [familyLinkId, childId, onToast, bumpUnreadIfClosed],
  )

  /** 요구 메시지를 말풍선으로 즉시 보여 줄 때 공통으로 씁니다 */
  function pushAssistantText(text: string) {
    setMessages((prev) => [...prev, { id: newId(), kind: 'text', role: 'assistant', text }])
    bumpUnreadIfClosed(1)
  }

  /** 새 말풍선이 생기면 목록 맨 아래로 스크롤 */
  useEffect(() => {
    if (!open) return
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, open, shell])

  /**
   * 빠른 칩으로 붙인 확인 카드가 보이도록 스크롤을 맞추고, 잠깐 테두리 강조를 켭니다.
   * 비개발자 설명: 새로 생긴 일정 카드가 화면 안으로 들어오게 자동으로 내려갑니다.
   */
  useEffect(() => {
    if (!open || !emphasizedParseMessageId) return
    const id = emphasizedParseMessageId
    const raf = requestAnimationFrame(() => {
      const el = document.querySelector(`[data-routine-agent-parse-focus="${CSS.escape(id)}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    const t = window.setTimeout(() => setEmphasizedParseMessageId(null), 2600)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(t)
    }
  }, [emphasizedParseMessageId, open])

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
    if (body.input_type === 'image') {
      /** 새 이미지를 다시 시도하는 순간 이전 실패 안내는 숨깁니다. */
      setImageFallbackPending(false)
    }
    try {
      const resRaw = await postAgentParse(body)
      const resNorm = normalizeParseResponse(resRaw)
      /** 법정 공휴일과 겹치면 `routine_off` 를 자동으로 켭니다(Supabase `public_holidays`). */
      const res = await enrichAgentParseResponseWithHolidayRoutineOff(resNorm)
      const isMulti = res.mode === 'multi' && (res.schedules?.length ?? 0) > 0
      const multiSlots: MultiSlotUi[] | undefined = isMulti
        ? (res.schedules ?? []).map((row) => ({
            event: row.event,
            status: 'pending' as const,
            slotSuggestions: [],
            holidayAutoFromPublic: Boolean(row.holiday_auto_from_public),
          }))
        : undefined
      const sug: SuggestionUi[] = (res.suggestions ?? []).map((s) => ({ ...s, status: 'pending' as const }))
      /**
       * 단건인데 제목/설명에 추출 오류·503 이 섞여 오면 성공이 아님 — 캘린더 동기화·파싱 카드 모두 생략.
       * (그대로 두면 오늘 날짜에 사용자 문장 전체가 제목인 일정이 생김)
       */
      if (!isMulti && shouldSkipSyncAgentEvent(res.event)) {
        /** HTTP 200 이지만 본문에 Gemini 오류가 섞인 경우 — 이미지일 때만 429/503/기타 말풍선 분기 */
        const errBlob = `${res.event.title ?? ''}\n${res.event.description ?? ''}`
        onToast(
          body.input_type === 'image'
            ? '이미지 분석을 완료하지 못했어요. 위 안내를 확인해 주세요.'
            : 'AI 서버가 잠시 바빠 일정을 읽지 못했어요. 잠시 후 다시 시도해 주세요.',
          false,
          true,
        )
        const assistantText =
          body.input_type === 'image'
            ? routineAgentImageParseAssistantMessage(null, errBlob)
            : '지금은 요청이 많아 응답이 지연되고 있어요. 잠시 후 같은 내용으로 다시 보내 주세요.'
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            kind: 'text',
            role: 'assistant',
            text: assistantText,
          },
        ])
        bumpUnreadIfClosed(1)
        setImageFallbackPending(true)
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
      if (body.input_type === 'image') setImageFallbackPending(false)
    } catch (err) {
      const raw = err instanceof Error ? err.message : '분석에 실패했어요'
      const httpStatus = err instanceof AgentParseRequestError ? err.status : null
      /** 이미지 파싱만 HTTP/본문으로 429·503·기타 안내를 말풍선으로 구분 */
      if (body.input_type === 'image') {
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            kind: 'text',
            role: 'assistant',
            text: routineAgentImageParseAssistantMessage(httpStatus, raw),
          },
        ])
        bumpUnreadIfClosed(1)
        onToast('이미지 분석을 완료하지 못했어요. 위 안내를 확인해 주세요.', false, true)
        setImageFallbackPending(true)
      } else {
        onToast(raw, false, true)
      }
    } finally {
      setLoading(false)
    }
  }

  /**
   * 공통 이미지 처리기
   * - 카메라/갤러리 입력을 같은 경로로 태워 파싱 요청을 보냅니다.
   * - 압축 실패 시 FileReader(base64)로 폴백해 업로드 실패율을 줄입니다.
   */
  const handlePickedImage = useCallback(
    async (file: File, source: 'camera' | 'gallery') => {
      const fileType = (file.type || '').toLowerCase()
      const fileLooksLikeImage =
        fileType.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(file.name || '')
      if (!fileLooksLikeImage) {
        onToast('이미지 파일만 선택할 수 있어요', false)
        return
      }
      /** 비개발자: 원본이 매우 크면 OCR 서버 요청이 실패할 수 있어 업로드 전에 한번 제한합니다. */
      if (file.size > 15 * 1024 * 1024) {
        onToast('이미지가 너무 커요. 15MB 이하 파일로 다시 시도해 주세요.', false)
        return
      }
      setImageFallbackPending(false)
      const sourceLabel = source === 'camera' ? '카메라 사진을 보냈어요' : '갤러리 이미지를 보냈어요'
      const fireScheduleImageParse = async (previewUrl: string, b64: string) => {
        setImagePreview(previewUrl)
        setImageBase64(b64)
        if (shell !== 'schedule_image' || !familyLinkId || !childId) return
        setMessages((prev) => [...prev, { id: newId(), kind: 'text', role: 'user', text: sourceLabel }])
        await runParse({
          family_link_id: familyLinkId,
          child_id: childId,
          input_type: 'image',
          image_base64: b64,
        })
        setImagePreview(null)
        setImageBase64(null)
        if (fileCameraRef.current) fileCameraRef.current.value = ''
        if (fileGalleryRef.current) fileGalleryRef.current.value = ''
      }
      const compressed = await compressImageFileToJpegPayload(file)
      if (compressed) {
        await fireScheduleImageParse(compressed.previewUrl, compressed.base64)
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const r = String(reader.result ?? '')
        if (!r) {
          onToast('이미지 파일을 읽지 못했어요. 다시 선택해 주세요.', false)
          return
        }
        void fireScheduleImageParse(r, stripDataUrlBase64(r))
      }
      reader.onerror = () => {
        onToast('이미지 파일을 읽지 못했어요. 다시 선택해 주세요.', false)
      }
      reader.readAsDataURL(file)
    },
    [childId, familyLinkId, onToast, shell],
  )

  /**
   * 이미지 선택 이벤트 핸들러(카메라/갤러리 공용)
   * - source 값으로 어떤 입력 흐름에서 왔는지 구분해 UX 문구를 다르게 보여줍니다.
   */
  const onPickImage = (source: 'camera' | 'gallery') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    void handlePickedImage(f, source)
  }

  /** STEP 1A-1 텍스트 [보내기] — 로컬 파싱 후 필요 시에만 Gemini */
  const handleSendComposer = async () => {
    if (!familyLinkId || !childId) {
      onToast('가족 연결 정보를 찾을 수 없어요. 잠시 후 다시 시도해 주세요.', false)
      return
    }
    const trimmed = composerText.trim()
    if (!trimmed) {
      onToast('메시지를 입력해 주세요', false)
      return
    }
    setMessages((prev) => [...prev, { id: newId(), kind: 'text', role: 'user', text: trimmed }])
    setComposerText('')

    /** TC-05~07: API 호출 전에 프론트에서 즉시 분기합니다 */
    const precheck = classifyTextBeforeApi(trimmed)
    if (precheck === 'missing_date') {
      pushAssistantText(`날짜가 언제인가요?
예) 4월 25일, 다음주 토요일`)
      return
    }
    if (precheck === 'missing_content') {
      pushAssistantText(`어떤 일정인가요?
예) 체육대회, 가족여행, 병원`)
      return
    }
    if (precheck === 'irrelevant') {
      pushAssistantText(`저는 일정 등록을 도와드리는
루틴 도우미예요.
날짜와 일정 내용을 입력하시거나
일정과 관련된 사진을 올려주세요.`)
      return
    }

    if (!shouldCallAPI(trimmed, false)) {
      const localPlan = buildScheduleFromText(trimmed)
      if (localPlan) {
        const resLocal = buildAgentParseResponseFromLocal(localPlan)
        const res = await enrichAgentParseResponseWithHolidayRoutineOff(resLocal)
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

  /** 루틴 관리 탭에서 나가면 홈(STEP 0)으로 */
  const closeRoutineEmbedded = useCallback(() => {
    setShell('welcome')
    setRoutineSubTab('routine')
    setWeeklyWizardStep('route')
  }, [])

  /** 처음 루틴 관리로 들어올 때만 주간 위저드를 1단계로 초기화(탭 안에서 뒤로 이동한 상태는 유지) */
  const prevShellRef = useRef<AgentPanelShell>('welcome')
  useEffect(() => {
    if (shell === 'routine_manage' && prevShellRef.current !== 'routine_manage') {
      setWeeklyWizardStep('route')
    }
    prevShellRef.current = shell
  }, [shell])

  /** 상단 [← 이전] — 스텝 스택을 한 단계만 줄입니다 */
  const goBack = useCallback(() => {
    if (shell === 'welcome') return
    if (shell === 'schedule_menu') {
      setShell('welcome')
      return
    }
    if (shell === 'schedule_text' || shell === 'chat' || shell === 'schedule_image') {
      setShell('schedule_menu')
      return
    }
    if (shell === 'routine_manage') {
      if (routineSubTab === 'special') {
        closeRoutineEmbedded()
        return
      }
      if (weeklyWizardStep === 'holiday' || weeklyWizardStep === 'holiday_direct') {
        setWeeklyWizardStep(weeklyWizardStep === 'holiday_direct' ? 'route' : 'weekend')
        return
      }
      if (weeklyWizardStep === 'weekend') {
        setWeeklyWizardStep('weekday')
        return
      }
      if (weeklyWizardStep === 'weekday') {
        setWeeklyWizardStep('route')
        return
      }
      if (weeklyWizardStep === 'done') {
        setWeeklyWizardStep('route')
        return
      }
      closeRoutineEmbedded()
    }
  }, [shell, routineSubTab, weeklyWizardStep, closeRoutineEmbedded])

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

  /**
   * [등록하기] 시 로컬 전용 파싱(deferCalendarSync 등)처럼 parse 에서 온 saved_event_id 가 없으면
   * commit-schedule 로 DB 행을 만들고 반환된 UUID 로만 localStorage id 를 맞춥니다.
   */
  const resolveDbCalendarEventIdForRegister = useCallback(
    async (mergedEvent: AgentParseEvent, savedFromParse: string | null): Promise<string | null> => {
      const trimmed = savedFromParse?.trim() || null
      if (trimmed) return trimmed
      if (!familyLinkId || !childId) return null
      const out = await postAgentCommitSchedule({
        family_link_id: familyLinkId,
        child_id: childId,
        input_type: 'text',
        text_input: mergedEvent.title?.trim() || '일정',
        event: mergedEvent,
      })
      const raw = out as { saved_event_id?: string | null; savedEventId?: string | null }
      return (raw.saved_event_id ?? raw.savedEventId)?.trim() || null
    },
    [familyLinkId, childId],
  )

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
      const routineOv: LocalCalendarEvent['routineOverride'] = payload.routineOffOn ? 'none' : 'weekend'

      const dbEventId = await resolveDbCalendarEventIdForRegister(mergedEvent, savedCalendarEventId)
      if (!dbEventId) {
        onToast(
          familyLinkId && childId
            ? '서버 일정 id를 받지 못했어요. 잠시 후 다시 시도해 주세요.'
            : '가족 연결 정보가 없어 저장할 수 없어요.',
          false,
        )
        return
      }
      if (payload.categoryMain) {
        await fetch('/api/calendar-event/update', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId: dbEventId, title: payload.title, startDate: payload.startDate, endDate: payload.endDate, eventType: localEventType, routineOverride: routineOv, description: payload.description, categoryMain: payload.categoryMain, categorySub: '', recurType: 'none' }),
        })
      }

      const priorLocal = calendarRowIdIn?.trim() || null
      if (priorLocal && priorLocal !== dbEventId) {
        rewriteLocalCalendarEventIdInStorage(priorLocal, dbEventId)
      }

      syncAgentEventToLocalCalendar(childId!, mergedEvent, dbEventId, { routineOverride: routineOv })
      patchLocalCalendarEventInStorage(dbEventId, {
        title: payload.title,
        startDate: payload.startDate,
        endDate: payload.endDate,
        eventType: localEventType,
        description: payload.description,
        routineOverride: routineOv,
        categoryMain: payload.categoryMain,
      })

      const rowId = dbEventId
      const pending = pendingSuggestions(suggestions)
      await approvePendingSuggestionsBatch(pending, payload.routineOffOn)
      setMessages((prev) =>
        prev.map((m) =>
          m.kind === 'parse' && m.id === parseMsgId
            ? {
                ...m,
                confirmComplete: true,
                calendarRowId: rowId,
                parseResult: { ...m.parseResult, event: mergedEvent, saved_event_id: dbEventId },
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
            ? { ...m, suggestions: mapSuggestionsAfterRejectAll(m.suggestions), confirmCancelled: true }
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
      const routineOvMulti: LocalCalendarEvent['routineOverride'] = payload.routineOffOn ? 'none' : 'weekend'

      const dbEventIdMulti = await resolveDbCalendarEventIdForRegister(mergedEvent, savedCalendarEventId)
      if (!dbEventIdMulti) {
        onToast(
          familyLinkId && childId
            ? '서버 일정 id를 받지 못했어요. 잠시 후 다시 시도해 주세요.'
            : '가족 연결 정보가 없어 저장할 수 없어요.',
          false,
        )
        return
      }
      if (payload.categoryMain) {
        await fetch('/api/calendar-event/update', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId: dbEventIdMulti, title: payload.title, startDate: payload.startDate, endDate: payload.endDate, eventType: localEventType, routineOverride: routineOvMulti, description: payload.description, categoryMain: payload.categoryMain, categorySub: '', recurType: 'none' }),
        })
      }

      const priorLocalMulti = calendarRowIdIn?.trim() || null
      if (priorLocalMulti && priorLocalMulti !== dbEventIdMulti) {
        rewriteLocalCalendarEventIdInStorage(priorLocalMulti, dbEventIdMulti)
      }

      syncAgentEventToLocalCalendar(childId!, mergedEvent, dbEventIdMulti, { routineOverride: routineOvMulti })
      patchLocalCalendarEventInStorage(dbEventIdMulti, {
        title: payload.title,
        startDate: payload.startDate,
        endDate: payload.endDate,
        eventType: localEventType,
        description: payload.description,
        routineOverride: routineOvMulti,
        categoryMain: payload.categoryMain,
      })

      const rowId = dbEventIdMulti
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
                  savedEventId: dbEventIdMulti,
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
              : {
                  ...slot,
                  slotSuggestions: mapSuggestionsAfterRejectAll(slot.slotSuggestions),
                  routineCardComplete: true,
                  routineCardCancelled: true,
                },
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

  /** 예전 안내 말풍선은 새 스텝 UI와 겹치므로 목록에서 제외합니다 */
  const filteredMessages = messages.filter(
    (m) => !(m.kind === 'text' && m.role === 'assistant' && m.text === LEGACY_SCHEDULE_INTRO),
  )

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
            {/* 모든 스텝 공통 상단: 왼쪽 < 이전(텍스트), 오른쪽 닫기(항상 노출) */}
            <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 bg-gradient-to-r from-sky-50/50 to-violet-50/40 px-3 py-2.5">
              <button
                type="button"
                onClick={() => goBack()}
                disabled={shell === 'welcome'}
                className="shrink-0 text-xs font-medium text-gray-700 transition-opacity active:opacity-60 disabled:opacity-30"
                aria-label="이전으로"
              >
                {'< 이전'}
              </button>
              <span className="flex min-w-0 flex-1 items-center justify-center gap-2">
                <span className="truncate text-xs font-black text-brand-text">루틴 도우미</span>
              </span>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 text-xs font-medium text-gray-700 transition-opacity active:opacity-60"
                aria-label="닫기"
              >
                닫기
              </button>
            </div>

            {/* STEP 0 — 홈 */}
            {shell === 'welcome' ? (
              <div className="shrink-0 space-y-4 border-b border-gray-100 bg-white px-3 pb-4 pt-4">
                <p className="text-center text-[15px] font-bold leading-snug text-gray-800">
                  안녕하세요! 무엇을 도와드릴까요?
                </p>
                <div className={`grid grid-cols-1 gap-3 ${showRoutineManageEntry ? 'sm:grid-cols-2' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setShell('schedule_menu')}
                    className="rounded-2xl border border-sky-200 bg-sky-50/95 px-4 py-4 text-center text-sm font-black text-sky-950 shadow-sm transition active:scale-[0.99]"
                  >
                    일정 등록
                  </button>
                  {showRoutineManageEntry ? (
                    <button
                      type="button"
                      disabled={!childId}
                      onClick={() => {
                        if (!childId) return
                        setShell('routine_manage')
                        setRoutineSubTab('routine')
                      }}
                      className="rounded-2xl border border-violet-200 bg-violet-50/95 px-4 py-4 text-center text-sm font-black text-violet-950 shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      루틴 관리
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* STEP 1A — 일정 등록 메뉴 */}
            {shell === 'schedule_menu' ? (
              <div className="routine-agent-hide-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto bg-white px-3 py-4">
                <p className="mb-4 text-center text-sm font-bold text-gray-800">일정을 어떻게 등록하시겠어요?</p>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setShell('schedule_text')}
                    className="rounded-2xl border border-sky-200 bg-sky-50/90 py-3 text-sm font-black text-sky-950 shadow-sm active:scale-[0.99]"
                  >
                    텍스트로 입력하기
                  </button>
                  <button
                    type="button"
                    onClick={() => setShell('schedule_image')}
                    className="rounded-2xl border border-violet-200 bg-violet-50/90 py-3 text-sm font-black text-violet-950 shadow-sm active:scale-[0.99]"
                  >
                    이미지로 등록하기
                  </button>
                </div>
                <div className="my-4 border-t border-gray-100" />
                <p className="mb-0.5 text-center text-[11px] font-bold text-gray-500">빠른 입력</p>
                <p className="mb-2 text-center text-[10px] font-medium leading-snug text-gray-400">
                  아래의 키워드로 빠르게 일정을 등록해보세요!
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {(
                    [
                      ['holiday', '공휴일'],
                      ['travel', '여행'],
                      ['event', '행사'],
                      ['education', '교육'],
                      ['health', '건강'],
                      ['etc', '기타'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => appendQuickKeywordPresetToChat(id)}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-black text-gray-700 shadow-sm active:scale-[0.99]"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* STEP 1A-1 텍스트 / STEP 1A-2 이미지 — 결과 카드는 동일 스크롤 영역 */}
            {shell === 'schedule_text' || shell === 'chat' || shell === 'schedule_image' ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {shell === 'schedule_text' ? (
                  <div className="shrink-0 space-y-3 border-b border-gray-100 bg-white px-3 py-3">
                    <p className="text-center text-sm font-bold text-gray-800">등록할 일정을 아래 형식으로 입력해 주세요.</p>
                    <div className="rounded-2xl border border-sky-100 bg-sky-50/80 px-3 py-3 text-left shadow-sm ring-1 ring-sky-100/60">
                      <p className="text-[11px] font-black text-sky-950">날짜 + 일정 + 특이사항</p>
                      <p className="mt-2 whitespace-pre-wrap text-[10px] font-medium leading-relaxed text-gray-700">
                        {`예) 4월 25일 체육대회 활동복, 도시락 준비
다음주 토요일 가족여행 장소는 영월 한옥마을
7월 말부터 여름방학기간 시작 `}
                      </p>
                    </div>
                  </div>
                ) : shell === 'schedule_image' ? (
                  <div className="shrink-0 space-y-2 border-b border-gray-100 bg-white px-3 py-3">
                    <p className="text-center text-sm font-bold leading-snug text-gray-800">
                      일정과 관련된 사진으로 쉽고 빠른 일정 등록이 가능해요.
                    </p>
                  </div>
                ) : null}
                {/* 대화·등록 카드 스크롤(막대는 CSS 로 숨김) */}
                <div className="routine-agent-hide-scrollbar min-h-0 flex-1 overflow-y-auto bg-white px-3 py-2">
              <ul className="flex flex-col gap-2">
                {filteredMessages.map((m) => {
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
                              aria-label="이전 일정"
                              className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-gray-500 disabled:opacity-40"
                            >
                              <ParentChevron direction="left" size="sm" />
                            </button>
                            <span>
                              &lt; {idx + 1} / {n} &gt;
                            </span>
                            <button
                              type="button"
                              disabled={idx >= n - 1}
                              onClick={() => setMultiIndex(m.id, idx + 1)}
                              aria-label="다음 일정"
                              className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-gray-500 disabled:opacity-40"
                            >
                              <ParentChevron direction="right" size="sm" />
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
                              showPublicHolidayAutoBanner={Boolean(slot.holidayAutoFromPublic)}
                              registrationComplete={Boolean(slot.routineCardComplete)}
                              cancelledComplete={Boolean(slot.routineCardCancelled)}
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
                  /** 빠른 칩으로 넣은 말풍선이면 확인 카드에서 제목 입력을 바로 켭니다 */
                  const fromQuickChip = quickChipParseMessageIdsRef.current.has(m.id)
                  return (
                    <li
                      key={m.id}
                      data-routine-agent-parse-focus={m.id}
                      className={`flex w-full justify-start ${
                        emphasizedParseMessageId === m.id
                          ? 'rounded-2xl p-0.5 ring-2 ring-sky-400 ring-offset-1 ring-offset-white'
                          : ''
                      }`}
                    >
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
                          showPublicHolidayAutoBanner={Boolean(m.parseResult.holiday_auto_applied)}
                          registrationComplete={Boolean(m.confirmComplete)}
                          cancelledComplete={Boolean(m.confirmCancelled)}
                          busy={suggestionSubmitKey === m.id || loading}
                          autoEditTitleOnMount={fromQuickChip}
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
                    <div className="flex items-start gap-2 rounded-2xl rounded-bl-md bg-sky-100/80 px-3 py-2 text-xs text-gray-600">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-300 border-t-sky-700" />
                      <p className="whitespace-pre-line leading-relaxed">
                        {`분석중...
분석이 완료되면 알려드릴게요!`}
                      </p>
                    </div>
                  </li>
                ) : null}
              </ul>
              <div ref={listEndRef} />
                </div>

                {shell === 'schedule_text' || shell === 'chat' ? (
                  <div className="shrink-0 border-t border-gray-100 bg-white px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
                    <textarea
                      value={composerText}
                      onChange={(e) => setComposerText(e.target.value)}
                      rows={3}
                      placeholder="날짜와 일정을 입력해 주세요"
                      className="routine-agent-hide-scrollbar mb-2 w-full resize-none rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                    />
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void handleSendComposer()}
                      className="w-full rounded-xl bg-gradient-to-r from-sky-400 to-violet-400 py-3 text-xs font-black text-white shadow-md disabled:opacity-50"
                    >
                      보내기
                    </button>
                  </div>
                ) : (
                  <div className="shrink-0 border-t border-gray-100 bg-white px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-3">
                    <input
                      ref={fileCameraRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={onPickImage('camera')}
                    />
                    <input
                      ref={fileGalleryRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={onPickImage('gallery')}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => fileCameraRef.current?.click()}
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 py-3 text-xs font-black text-violet-950 shadow-sm disabled:opacity-50"
                      >
                        카메라 촬영
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => fileGalleryRef.current?.click()}
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 py-3 text-xs font-black text-sky-950 shadow-sm disabled:opacity-50"
                      >
                        갤러리 선택
                      </button>
                    </div>
                    <p className="mt-1 text-center text-[10px] font-medium text-gray-500">
                      카메라 촬영과 앨범 선택을 모두 지원해요.
                    </p>
                    {imageFallbackPending ? (
                      <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2">
                        <p className="text-[10px] font-semibold leading-snug text-amber-900">
                          사진에서 날짜/장소를 읽지 못했어요. 아래 버튼으로 텍스트 입력으로 바로 전환할 수 있어요.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setImageFallbackPending(false)
                            setShell('schedule_text')
                          }}
                          className="mt-1.5 w-full rounded-lg border border-amber-300 bg-white py-2 text-[11px] font-black text-amber-900"
                        >
                          텍스트로 직접 입력하기
                        </button>
                      </div>
                    ) : null}
                    {imagePreview ? (
                      // eslint-disable-next-line @next/next/no-img-element -- 로컬 미리보기
                      <img src={imagePreview} alt="" className="mt-2 max-h-28 w-full rounded-lg object-contain ring-1 ring-violet-100" />
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}

            {shell === 'routine_manage' && childId ? (
              <div className="flex min-h-0 flex-1 flex-col gap-2 border-t border-gray-100 bg-white px-2 pb-2 pt-2">
                <div className="flex shrink-0 gap-1.5" role="tablist" aria-label="루틴 관리 하위 탭">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={routineSubTab === 'routine'}
                    onClick={() => setRoutineSubTab('routine')}
                    className={`min-h-11 min-w-0 flex-1 rounded-xl border px-2 py-2 text-center text-xs font-black transition ${
                      routineSubTab === 'routine'
                        ? 'border-sky-300 bg-sky-50 text-sky-950 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    주간 루틴
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={routineSubTab === 'special'}
                    onClick={() => setRoutineSubTab('special')}
                    className={`min-h-11 min-w-0 flex-1 rounded-xl border px-2 py-2 text-center text-xs font-black transition ${
                      routineSubTab === 'special'
                        ? 'border-violet-300 bg-violet-50 text-violet-950 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    스페셜 미션
                  </button>
                </div>
                <div className="routine-agent-hide-scrollbar flex min-h-0 flex-1 flex-col overflow-hidden">
                  {routineSubTab === 'routine' ? (
                    <>
                      <p className="shrink-0 px-1 pb-2 text-center text-[11px] font-medium leading-relaxed text-gray-600">
                        아이의 일상 루틴을 설정해요. 주중과 주말/공휴일을 따로 설정할 수 있어요.
                      </p>
                      <RoutineKeywordBuilderSheet
                        key={`agent-routine-kw-${childId}`}
                        embedded
                        embeddedPanelWizard
                        wizardStep={weeklyWizardStep}
                        onWizardStepChange={setWeeklyWizardStep}
                        suppressCloseAfterSuccess
                        open
                        onClose={closeRoutineEmbedded}
                        linkedChildId={childId}
                        hasSchool={hasSchool}
                        routineMissions={routineMissions}
                        onSuccess={() => onToast('루틴이 업데이트됐어요!')}
                      />
                    </>
                  ) : (
                    <>
                      <p className="shrink-0 px-1 pb-2 text-center text-[11px] font-medium leading-relaxed text-gray-600">
                        매일 반복되는 특별 미션을 설정해요. 이벤트 키워드를 선택하거나 목록에서 직접 추가할 수 있어요.
                      </p>
                      <SpecialMissionAddSheet
                        key={`agent-routine-sp-${childId}`}
                        embedded
                        embeddedMinimalChrome
                        parentHandlesCloseOnSuccess
                        open
                        onClose={closeRoutineEmbedded}
                        childId={childId}
                        specialMissions={specialMissions}
                        onToast={onToast}
                        successToastOverride="스페셜 미션이 업데이트됐어요!"
                      />
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
