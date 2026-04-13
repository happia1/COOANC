'use client'

/**
 * 루틴 탭 — 우측 하단에서 열리는 「챗봇」슬라이딩 패널입니다.
 * - Framer Motion 으로 오른쪽에서 패널이 들어옵니다. 패널·대화 스크롤 영역 배경은 흰색으로 통일합니다.
 * - 상단 인텐트 UI: 카테고리 탭 4개는 항상 보이고, 세부 인텐트 칩 2개는 해당 카테고리를 눌렀을 때만 펼칩니다(같은 탭 재클릭 시 접힘).
 * - 가로·세로 스크롤 **막대(슬라이드 바)** 는 `globals.css` 의 `.routine-agent-hide-scrollbar` 로 숨기되, 스크롤 동작은 그대로 둡니다.
 * - 부모 탭 `<main>` 이 스크롤 컨테이너라 막대가 오버레이 위에 겹칠 수 있어, 열릴 때 `overflow` 를 잠그고 z-index 를 시트들보다 높입니다.
 * - 텍스트·이미지·직접 입력은 `/agent-b/parse` 로 보냅니다. 한 건만 나오면 곧바로 DB 초안 + 제안이 붙고, 여러 건이면 `< 1/N >` 로 한 줄씩 확인한 뒤 [등록] 시 `/agent-b/commit-schedule` 로 저장합니다.
 * - 이미지는 브라우저에서 JPEG 로 줄여 보내 MIME 불일치·용량 초과 오류를 줄입니다.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
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

type Props = {
  open: boolean
  onClose: () => void
  familyLinkId: string | null
  childId: string | null
  onToast: (msg: string, ok?: boolean, multiline?: boolean) => void
}

/** AI 가 처음 인사할 때 쓰는 고정 문구(줄바꿈 포함) */
const WELCOME_TEXT = `안녕하세요! 어떤 걸 도와드릴까요?
위에서 카테고리를 한 번 누르면 세부 칩이 펼쳐져요. 칩을 누르면 질문 가이드가 나옵니다. 필요하면 직접 입력해도 됩니다 😊`

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
  return {
    event: {
      type: t,
      title: String(pe.title ?? '').trim() || '일정',
      start_date: String(pe.start_date ?? '').trim(),
      end_date: pe.end_date ?? null,
      ...(desc ? { description: desc } : {}),
    },
    suggestions: [],
  }
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

  useEffect(() => {
    setMounted(true)
  }, [])

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

  /** 패널을 닫을 때 입력·대화를 비웁니다 */
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
   * 패널 닫힘: 입력·대화 초기화
   * 패널 열림: 먼저 폼을 비운 뒤 환영 인사로 새 대화 시작(이전 세션 잔여 입력 방지)
   */
  useEffect(() => {
    if (!open) {
      resetAll()
      return
    }
    resetAll()
    setMessages([{ id: newId(), kind: 'text', role: 'assistant', text: WELCOME_TEXT }])
  }, [open, resetAll])

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
      const slotSuggestions: SuggestionUi[] = (out.suggestions ?? []).map(
        (s): SuggestionUi => ({
          type: s.type,
          detail: s.detail,
          suggestion_id: s.suggestion_id,
          status: 'pending',
        }),
      )
      setMultiEdit((cur) => (cur?.parseMsgId === parseMsgId && cur.slotIndex === slotIndex ? null : cur))
      setMessages((prev) =>
        prev.map((m) => {
          if (m.kind !== 'parse' || m.id !== parseMsgId || !m.multiSlots) return m
          const nextSlots = m.multiSlots.map((s, j) =>
            j === slotIndex ? { ...s, status: 'committed' as const, slotSuggestions } : s,
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
      onToast('이 일정을 등록했어요. 아래 제안을 적용할지 골라 주세요')
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

  /** 제안 카드의 적용/거절 — suggestion_id 가 있을 때만 서버로 갑니다 */
  const handleApproveRow = async (parseMsgId: string, row: SuggestionUi, action: 'approved' | 'rejected') => {
    if (!row.suggestion_id) {
      onToast('이 제안은 서버에 저장되지 않아 처리할 수 없어요. 에이전트를 최신 버전으로 배포했는지 확인해 주세요.', false)
      return
    }
    try {
      await postAgentApprove(row.suggestion_id, action)
      setMessages((prev) =>
        prev.map((m) => {
          if (m.kind !== 'parse' || m.id !== parseMsgId) return m
          return {
            ...m,
            suggestions: m.suggestions.map((s) =>
              s.suggestion_id === row.suggestion_id
                ? { ...s, status: action === 'approved' ? 'approved' : 'rejected' }
                : s,
            ),
          }
        }),
      )
      onToast(action === 'approved' ? '적용했어요' : '거절했어요')
    } catch (e) {
      onToast(e instanceof Error ? e.message : '처리 실패', false)
    }
  }

  /** 다건 일정 중 한 줄에 붙은 제안만 골라 승인/거절합니다 */
  const handleApproveRowInMultiSlot = async (
    parseMsgId: string,
    slotIndex: number,
    row: SuggestionUi,
    action: 'approved' | 'rejected',
  ) => {
    if (!row.suggestion_id) {
      onToast('이 제안은 서버에 저장되지 않아 처리할 수 없어요.', false)
      return
    }
    try {
      await postAgentApprove(row.suggestion_id, action)
      setMessages((prev) =>
        prev.map((m) => {
          if (m.kind !== 'parse' || m.id !== parseMsgId || !m.multiSlots) return m
          const nextSlots = m.multiSlots.map((slot, j) =>
            j !== slotIndex
              ? slot
              : {
                  ...slot,
                  slotSuggestions: slot.slotSuggestions.map((s): SuggestionUi =>
                    s.suggestion_id === row.suggestion_id
                      ? {
                          type: s.type,
                          detail: s.detail,
                          suggestion_id: s.suggestion_id,
                          status: action === 'approved' ? 'approved' : 'rejected',
                        }
                      : s,
                  ),
                },
          )
          return { ...m, multiSlots: nextSlots }
        }),
      )
      onToast(action === 'approved' ? '적용했어요' : '거절했어요')
    } catch (e) {
      onToast(e instanceof Error ? e.message : '처리 실패', false)
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

            {/* 인텐트: 카테고리 탭 4개 항상 표시 → 탭 클릭 시에만 아래 세부 칩 2개 펼침 */}
            <div className="shrink-0 border-b border-gray-100 bg-white px-3 py-2">
              <p className="mb-1.5 text-[10px] font-bold text-gray-400">무엇을 도와드릴까요?</p>
              <div
                className="grid grid-cols-4 gap-1"
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
                      className={`rounded-lg border px-1 py-2 text-center text-[10px] font-black leading-tight transition active:scale-[0.98] ${
                        selected ? cat.tabActiveClass : cat.tabInactiveClass
                      }`}
                    >
                      {cat.label}
                    </button>
                  )
                })}
              </div>
              {activeIntentCategory ? (
                <div
                  className="mt-2 grid grid-cols-2 gap-2"
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
                        className={`rounded-xl border px-2 py-2.5 text-center text-[11px] font-black leading-snug shadow-sm transition active:scale-[0.98] ${chipClass}`}
                      >
                        {chip.label}
                      </button>
                    )
                  })}
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
                        <div className="max-w-[95%] space-y-2 rounded-2xl border border-indigo-100 bg-white p-3 shadow-md ring-1 ring-indigo-50">
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
                            <ul className="space-y-2 pl-0.5">
                              {slot.slotSuggestions.map((s, si) => (
                                <li
                                  key={`${s.suggestion_id ?? si}-${s.type}`}
                                  className="rounded-2xl border border-emerald-100/80 bg-white/95 p-3 text-[11px] shadow-sm"
                                >
                                  <p className="font-bold text-emerald-950">{s.type}</p>
                                  <p className="mt-1 leading-snug text-gray-700">{s.detail}</p>
                                  {s.status === 'pending' ? (
                                    <div className="mt-2 flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void handleApproveRowInMultiSlot(m.id, idx, s, 'approved')
                                        }
                                        className="flex-1 rounded-xl bg-emerald-500 py-2 text-[10px] font-black text-white active:scale-[0.99]"
                                      >
                                        적용하기
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void handleApproveRowInMultiSlot(m.id, idx, s, 'rejected')
                                        }
                                        className="flex-1 rounded-xl bg-rose-100 py-2 text-[10px] font-black text-rose-800 active:scale-[0.99]"
                                      >
                                        거절하기
                                      </button>
                                    </div>
                                  ) : (
                                    <p className="mt-2 text-[10px] font-bold text-gray-500">
                                      {s.status === 'approved' ? '✓ 적용됨' : '거절됨'}
                                    </p>
                                  )}
                                </li>
                              ))}
                            </ul>
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
                      <div className="max-w-[95%] space-y-2">
                        <div className="whitespace-pre-wrap rounded-2xl rounded-bl-md bg-sky-100/90 px-3 py-2 text-xs leading-relaxed text-gray-900 shadow-sm">
                          <p className="font-black text-sky-950">분석된 일정</p>
                          <p className="mt-1 font-bold">{ev.title || '일정'}</p>
                          <p className="mt-0.5 text-[10px] text-gray-600">
                            유형: {ev.type} · {ev.start_date}
                            {ev.end_date ? ` ~ ${ev.end_date}` : ''}
                          </p>
                        </div>
                        {m.suggestions.length > 0 ? (
                          <ul className="space-y-2 pl-0.5">
                            {m.suggestions.map((s, idx) => (
                              <li
                                key={`${s.suggestion_id ?? idx}-${s.type}`}
                                className="rounded-2xl border border-emerald-100/80 bg-white/95 p-3 text-[11px] shadow-sm"
                              >
                                <p className="font-bold text-emerald-950">{s.type}</p>
                                <p className="mt-1 leading-snug text-gray-700">{s.detail}</p>
                                {s.status === 'pending' ? (
                                  <div className="mt-2 flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void handleApproveRow(m.id, s, 'approved')}
                                      className="flex-1 rounded-xl bg-emerald-500 py-2 text-[10px] font-black text-white active:scale-[0.99]"
                                    >
                                      적용하기
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleApproveRow(m.id, s, 'rejected')}
                                      className="flex-1 rounded-xl bg-rose-100 py-2 text-[10px] font-black text-rose-800 active:scale-[0.99]"
                                    >
                                      거절하기
                                    </button>
                                  </div>
                                ) : (
                                  <p className="mt-2 text-[10px] font-bold text-gray-500">
                                    {s.status === 'approved' ? '✓ 적용됨' : '거절됨'}
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-[10px] text-gray-500">추가 제안이 없어요.</p>
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
