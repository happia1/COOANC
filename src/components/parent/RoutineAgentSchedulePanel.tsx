'use client'

/**
 * 루틴 탭 — 우측 하단에서 열리는 「챗봇」슬라이딩 패널입니다.
 * - Framer Motion 으로 오른쪽에서 패널이 들어옵니다. 패널·대화 스크롤 영역 배경은 흰색으로 통일합니다.
 * - 상단 키워드는 한 줄 가로 스크롤(칩 나열) — 항목을 더 추가해도 옆으로 밀어 볼 수 있습니다.
 * - 텍스트·이미지·아래 직접 입력 폼은 모두 `/agent-b/parse` 로 보내고, 돌아온 제안은 [적용하기]/[거절하기]로 `/agent-b/approve` 합니다.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  postAgentApprove,
  postAgentParse,
  type AgentParseResponse,
  type AgentParseSuggestion,
} from '@/lib/agentApi'
import { getSeoulDateString } from '@/lib/koreaDate'
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
위 버튼을 클릭하거나 직접 입력해보세요 😊`

/** 빠른 키워드 칩 — 순서대로 한 줄 스크롤에 나열(항목 추가 시 배열만 늘리면 됨) */
type RoutineKeywordChip = { id: string; label: string; prompt: string }

const ROUTINE_KEYWORD_CHIPS: RoutineKeywordChip[] = [
  { id: 'add', label: '일정추가', prompt: '어떤 일정인가요? (예: 제주도 여행, 병원 방문)' },
  { id: 'routine', label: '루틴조정', prompt: '어떤 루틴을 조정할까요?' },
  { id: 'vacation', label: '방학설정', prompt: '방학 기간이 언제인가요? (예: 7월 25일부터 8월 20일)' },
  { id: 'mission', label: '미션제안', prompt: '어떤 상황에 맞는 미션을 원하시나요?' },
]

/** 칩마다 살짝 다른 파스텔 테두리·배경(인덱스 % 길이 로 순환) */
const KEYWORD_CHIP_STYLES = [
  'border-teal-100 bg-teal-50/90 text-teal-900',
  'border-amber-100 bg-amber-50/90 text-amber-900',
  'border-violet-100 bg-violet-50/90 text-violet-900',
  'border-rose-100 bg-rose-50/90 text-rose-900',
] as const

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

type ChatParseMessage = {
  id: string
  kind: 'parse'
  role: 'assistant'
  parseResult: AgentParseResponse
  suggestions: SuggestionUi[]
}

type ChatMessage = ChatTextMessage | ChatParseMessage

/** data URL 에서 순수 base64 문자열만 떼어냅니다(서버에 그대로 보내기 위함) */
function stripDataUrlBase64(dataUrl: string): string {
  const i = dataUrl.indexOf('base64,')
  if (i === -1) return dataUrl.trim()
  return dataUrl.slice(i + 'base64,'.length).trim()
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
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) {
      onToast('이미지 파일만 선택할 수 있어요', false)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const r = String(reader.result ?? '')
      setImagePreview(r)
      setImageBase64(stripDataUrlBase64(r))
    }
    reader.readAsDataURL(f)
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
      const res = await postAgentParse(body)
      const sug: SuggestionUi[] = (res.suggestions ?? []).map((s) => ({ ...s, status: 'pending' as const }))
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          kind: 'parse',
          role: 'assistant',
          parseResult: res,
          suggestions: sug,
        },
      ])
      onToast('AI 분석이 완료됐어요')
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

  /** 키워드 pill — 안내 문구만 AI 말풍선으로 추가 */
  const pushKeywordPrompt = (prompt: string) => {
    setMessages((prev) => [...prev, { id: newId(), kind: 'text', role: 'assistant', text: prompt }])
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

  if (!mounted || typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="routine-agent-chat-panel"
          className="fixed inset-0 z-[93]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* 반투명 배경: 탭하면 패널만 닫힘 */}
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="패널 닫기" onClick={onClose} />
          <motion.aside
            className="absolute inset-y-0 right-0 flex w-[min(100%,24rem)] flex-col border-l border-gray-200 bg-white shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 상단 바: 파비콘 + 제목 + 닫기(브라우저 탭과 같은 아이콘) */}
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-3 py-3">
              <span className="flex min-w-0 items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- 정적 파비콘(public), next/image localPatterns 밖 */}
                <img
                  src="/favicon-96x96.png"
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

            {/* 키워드: 한 줄 가로 스크롤 — 칩이 많아지면 손가락·트랙패드로 옆으로 밀어 볼 수 있음 */}
            <div className="shrink-0 border-b border-gray-100 bg-white py-2">
              <div
                className="flex snap-x snap-proximity touch-pan-x gap-2 overflow-x-auto overscroll-x-contain px-3 pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
                role="list"
                aria-label="루틴 도우미 빠른 키워드"
              >
                {ROUTINE_KEYWORD_CHIPS.map((kw, i) => (
                  <button
                    key={kw.id}
                    type="button"
                    role="listitem"
                    onClick={() => pushKeywordPrompt(kw.prompt)}
                    className={`snap-start shrink-0 whitespace-nowrap rounded-full border px-3 py-2 text-center text-[11px] font-black shadow-sm transition active:scale-[0.98] ${KEYWORD_CHIP_STYLES[i % KEYWORD_CHIP_STYLES.length]}`}
                  >
                    {kw.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 대화창 전체 영역 — 스크롤 배경도 흰색으로 통일 */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-white px-3 py-2">
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
                      className="w-full resize-none rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
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
                  className="min-h-0 flex-1 resize-none rounded-xl border border-gray-200 bg-white px-2 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
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
