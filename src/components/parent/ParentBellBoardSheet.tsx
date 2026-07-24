'use client'

/**
 * 부모 상단 「알림·공지」버튼용 게시판 시트입니다.
 * - 구매 승인 대기 「알림」은 부모가 행을 눌러 확인하면 사라지며, 「공지」는 Supabase notices 와 연동된 접기·펼치기 블록 목록입니다.
 * - 루틴 알람은 상단바의 알람시계 아이콘에서만 엽니다.
 */

import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss'
import ParentNoticeSlides from '@/components/parent/ParentNoticeSlides'

type RapidTapAlert = {
  id: string
  child_id: string
  detected_at: string
  mission_count: number
}

type Props = {
  open: boolean
  onClose: () => void
  /** 팝업 "더 보기" 등으로 열렸을 때, 자동으로 펼쳐서 보여 줄 공지 id */
  focusNoticeId?: string | null
  /** 아직 확인하지 않은 구매 승인 대기 건수 — 0이면 알림 구역은 숨깁니다 */
  unreadPendingCount: number
  /** 승인 탭으로 이동하기 직전에 호출해, 해당 알림을 확인한 것으로 기록합니다 */
  onAcknowledgePurchaseNotifications: () => void
  /** 최근 10분 이내 미확인 연속 탭 알림 목록 */
  rapidTapAlerts?: RapidTapAlert[]
  /** 연속 탭 알림 확인 처리 콜백 */
  onAcknowledgeRapidTapAlerts?: () => void
}

export default function ParentBellBoardSheet({
  open,
  onClose,
  focusNoticeId = null,
  unreadPendingCount,
  onAcknowledgePurchaseNotifications,
  rapidTapAlerts = [],
  onAcknowledgeRapidTapAlerts,
}: Props) {
  const [portalReady, setPortalReady] = useState(false)
  const [sheetEntered, setSheetEntered] = useState(false)
  const swipe = useSwipeToDismiss(onClose)

  useLayoutEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    if (!open) {
      setSheetEntered(false)
      return
    }
    setSheetEntered(false)
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setSheetEntered(true))
    })
    return () => cancelAnimationFrame(id)
  }, [open])

  if (!open) return null

  const overlay = (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby="parent-bell-board-title">
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="닫기" onClick={onClose} />
      {/*
        모바일·패드 세로: 아래 시트 — 가로 전폭(max-w 없음).
        패드 가로(md+landscape): 우측 패널, 최대 폭 max-w-md.
      */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center md:landscape:inset-x-0 md:landscape:inset-y-0 md:landscape:bottom-0 md:landscape:left-auto md:landscape:right-0 md:landscape:top-0 md:landscape:justify-end">
        <section
          className={`pointer-events-auto flex max-h-[min(85dvh,100vh-1rem)] w-full max-w-none flex-col rounded-t-2xl bg-white shadow-2xl transition-transform duration-300 ease-out md:landscape:h-full md:landscape:max-h-none md:landscape:w-[21rem] md:landscape:max-w-[21rem] md:landscape:rounded-none md:landscape:rounded-l-2xl ${
            sheetEntered
              ? 'translate-y-0 md:landscape:translate-y-0 md:landscape:translate-x-0'
              : 'translate-y-full md:landscape:translate-y-0 md:landscape:translate-x-full'
          }`}
          style={swipe.dragStyle}
        >
          {/* 가로 모드에서는 Mac/태블릿에서 흔한 하단 시트 손잡이 막대는 숨깁니다 */}
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-200 md:landscape:hidden" aria-hidden />
          <div className="touch-none border-b border-gray-100 px-4 pb-2 pt-3" {...swipe.handleProps}>
            <p id="parent-bell-board-title" className="text-center text-sm font-black text-gray-900">
              알림 · 공지
            </p>
            <p className="mt-1 text-center text-[10px] leading-snug text-gray-500">
              처리할 알림과 안내 공지를 한곳에서 확인해요.
            </p>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 [scrollbar-gutter:stable]">
            {(unreadPendingCount > 0 || rapidTapAlerts.length > 0) ? (
              <div>
                <p className="mb-2 px-0.5 text-[10px] font-black uppercase tracking-wide text-gray-500">알림</p>
                <ul className="space-y-2">
                  {/* 구매 승인 대기 알림 */}
                  {unreadPendingCount > 0 ? (
                    <li>
                      <Link
                        href="/parent/approval"
                        onClick={() => {
                          onAcknowledgePurchaseNotifications()
                          onClose()
                        }}
                        className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-3 transition-colors hover:bg-gray-50"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-gray-900">구매 요청 {unreadPendingCount}건 대기 중</p>
                          <p className="mt-1 text-[11px] leading-relaxed text-gray-600">승인 탭에서 처리할 수 있어요</p>
                        </div>
                        <span className="shrink-0 text-lg font-bold text-gray-400" aria-hidden>›</span>
                      </Link>
                    </li>
                  ) : null}

                  {/* 연속 탭 알림 — 자녀가 3초 이내에 미션 5개 이상을 눌렀을 때 표시됩니다 */}
                  {rapidTapAlerts.length > 0 ? (
                    <li>
                      <Link
                        href="/parent/approval"
                        onClick={() => {
                          void onAcknowledgeRapidTapAlerts?.()
                          onClose()
                        }}
                        className="flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3 transition-colors hover:bg-red-100"
                      >
                        <div className="min-w-0">
                          <div className="mb-1 flex items-center gap-1.5">
                            <span className="inline-block rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-black text-white">
                              주의
                            </span>
                            <p className="text-xs font-extrabold text-red-900">
                              미션 카드 연속 탭 감지됨
                            </p>
                          </div>
                          <p className="text-[11px] leading-relaxed text-red-700">
                            {rapidTapAlerts.length > 1
                              ? `${rapidTapAlerts.length}회 연속 탭이 감지됐어요.`
                              : `미션 ${rapidTapAlerts[0]?.mission_count ?? 5}개를 3초 이내에 탭했어요.`}
                            {' '}승인 탭에서 롤백할 수 있어요.
                          </p>
                          <p className="mt-1 text-[10px] text-red-500">
                            {new Date(rapidTapAlerts[0]?.detected_at ?? '').toLocaleTimeString('ko-KR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })} 발생
                          </p>
                        </div>
                        <span className="shrink-0 text-lg font-bold text-red-400" aria-hidden>›</span>
                      </Link>
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            <ParentNoticeSlides active={open} onClose={onClose} focusNoticeId={focusNoticeId} />
          </div>
        </section>
      </div>
    </div>
  )

  if (!portalReady) return null
  return createPortal(overlay, document.body)
}
