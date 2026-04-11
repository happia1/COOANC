'use client'

/**
 * 루틴 탭 — 오른쪽에서 슬라이드되는 「일정 등록 + AI 제안」패널입니다.
 * - 에이전트 B `/agent-b/parse` 로 텍스트·이미지를 보내고, 돌아온 제안마다 승인/거절(`/agent-b/approve`)을 호출합니다.
 * - 이미지는 FileReader 로 base64 만 추출해 전송합니다(data URL 접두사 제거).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { postAgentApprove, postAgentParse, type AgentParseResponse, type AgentParseSuggestion } from '@/lib/agentApi'

type Props = {
  open: boolean
  onClose: () => void
  familyLinkId: string | null
  childId: string | null
  onToast: (msg: string, ok?: boolean, multiline?: boolean) => void
}

type SuggestionUi = AgentParseSuggestion & { status: 'pending' | 'approved' | 'rejected' }

function stripDataUrlBase64(dataUrl: string): string {
  const i = dataUrl.indexOf('base64,')
  if (i === -1) return dataUrl.trim()
  return dataUrl.slice(i + 'base64,'.length).trim()
}

export default function RoutineAgentSchedulePanel({
  open,
  onClose,
  familyLinkId,
  childId,
  onToast,
}: Props) {
  const [mounted, setMounted] = useState(false)
  const [text, setText] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [parseResult, setParseResult] = useState<AgentParseResponse | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestionUi[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

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

  /** 패널을 닫을 때 입력·결과를 비워 다음에 깨끗하게 열립니다. */
  const resetForm = useCallback(() => {
    setText('')
    setImagePreview(null)
    setImageBase64(null)
    setParseResult(null)
    setSuggestions([])
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  useEffect(() => {
    if (!open) resetForm()
  }, [open, resetForm])

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

  const handleSubmit = async () => {
    if (!familyLinkId || !childId) {
      onToast('가족 연결 정보를 찾을 수 없어요. 잠시 후 다시 시도해 주세요.', false)
      return
    }
    const hasImg = Boolean(imageBase64 && imageBase64.length > 0)
    const trimmed = text.trim()
    if (!hasImg && !trimmed) {
      onToast('일정 문구를 입력하거나 이미지를 첨부해 주세요', false)
      return
    }

    setLoading(true)
    setParseResult(null)
    setSuggestions([])
    try {
      const body =
        hasImg
          ? {
              family_link_id: familyLinkId,
              child_id: childId,
              input_type: 'image' as const,
              image_base64: imageBase64!,
              text_input: trimmed || undefined,
            }
          : {
              family_link_id: familyLinkId,
              child_id: childId,
              input_type: 'text' as const,
              text_input: trimmed,
            }
      const res = await postAgentParse(body)
      setParseResult(res)
      setSuggestions(
        (res.suggestions ?? []).map((s) => ({
          ...s,
          status: 'pending' as const,
        })),
      )
      onToast('AI 분석이 완료됐어요')
    } catch (err) {
      onToast(err instanceof Error ? err.message : '분석에 실패했어요', false, true)
    } finally {
      setLoading(false)
    }
  }

  const handleApproveRow = async (row: SuggestionUi, action: 'approved' | 'rejected') => {
    if (!row.suggestion_id) {
      onToast('이 제안은 서버에 저장되지 않아 처리할 수 없어요. 에이전트를 최신 버전으로 배포했는지 확인해 주세요.', false)
      return
    }
    try {
      await postAgentApprove(row.suggestion_id, action)
      setSuggestions((prev) =>
        prev.map((s) =>
          s.suggestion_id === row.suggestion_id ? { ...s, status: action === 'approved' ? 'approved' : 'rejected' } : s,
        ),
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
          key="routine-agent-panel"
          className="fixed inset-0 z-[93]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="패널 닫기" onClick={onClose} />
          <motion.aside
            className="absolute inset-y-0 right-0 flex w-[min(100%,22rem)] flex-col border-l border-sky-100 bg-gradient-to-b from-white via-sky-50/40 to-blue-50 shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            <div className="flex items-center justify-between border-b border-sky-100/80 px-3 py-3">
              <p className="text-sm font-black text-sky-950">📅 일정 등록하기</p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-2 py-1 text-xs font-bold text-sky-700 hover:bg-white/80"
              >
                닫기
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mb-3 w-full rounded-xl border border-dashed border-sky-200 bg-white/90 py-3 text-center text-xs font-bold text-sky-800 shadow-sm active:scale-[0.99]"
              >
                📷 이미지 첨부
              </button>

              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element -- 사용자가 고른 로컬 미리보기
                <img src={imagePreview} alt="" className="mb-3 max-h-32 w-full rounded-lg object-contain ring-1 ring-sky-100" />
              ) : null}

              <label className="block text-[10px] font-bold text-gray-500">일정 설명</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                placeholder='예: 다음주 제주도 여행'
                className="mt-1 w-full resize-none rounded-xl border border-sky-100 bg-white px-3 py-2 text-xs text-gray-800 shadow-inner outline-none ring-0 focus:border-sky-300"
              />

              <button
                type="button"
                disabled={loading}
                onClick={() => void handleSubmit()}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 py-3 text-xs font-black text-white shadow-md disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    분석 중…
                  </>
                ) : (
                  '등록하기'
                )}
              </button>

              {parseResult ? (
                <div className="mt-5 border-t border-sky-100/80 pt-4">
                  <p className="text-[11px] font-black text-gray-800">── AI 제안 결과 ──</p>
                  <div className="mt-2 rounded-xl bg-white/90 p-3 text-[11px] shadow-sm ring-1 ring-sky-50">
                    <p className="font-bold text-sky-900">{parseResult.event.title || '일정'}</p>
                    <p className="mt-1 text-[10px] text-gray-600">
                      유형: {parseResult.event.type} · {parseResult.event.start_date}
                      {parseResult.event.end_date ? ` ~ ${parseResult.event.end_date}` : ''}
                    </p>
                  </div>

                  <ul className="mt-3 space-y-2">
                    {suggestions.map((s, idx) => (
                      <li
                        key={`${s.suggestion_id ?? idx}-${s.type}`}
                        className="rounded-xl bg-white/95 p-3 text-[11px] shadow-sm ring-1 ring-violet-100/80"
                      >
                        <p className="font-bold text-violet-950">{s.type}</p>
                        <p className="mt-1 leading-snug text-gray-700">{s.detail}</p>
                        {s.status === 'pending' ? (
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => void handleApproveRow(s, 'approved')}
                              className="flex-1 rounded-lg bg-emerald-500 py-2 text-[10px] font-black text-white active:scale-[0.99]"
                            >
                              적용하기
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleApproveRow(s, 'rejected')}
                              className="flex-1 rounded-lg bg-gray-200 py-2 text-[10px] font-black text-gray-700 active:scale-[0.99]"
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
                  {suggestions.length === 0 ? (
                    <p className="mt-2 text-[10px] text-gray-500">이번 분석에서 추가 제안이 없어요.</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
