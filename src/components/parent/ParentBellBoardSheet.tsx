'use client'

/**
 * 부모 상단 「알림·공지」버튼용 게시판 시트입니다.
 * - 구매 승인 대기 「알림」은 부모가 행을 눌러 확인하면 사라지며, 안내 「공지」목록은 그대로 둡니다.
 * - 루틴 알람은 상단바의 알람시계 아이콘에서만 엽니다.
 */

import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PARENT_BELL_NOTICE_ITEMS } from '@/lib/parentBellNoticeItems'

type Props = {
  open: boolean
  onClose: () => void
  /** 아직 확인하지 않은 구매 승인 대기 건수 — 0이면 알림 구역은 숨깁니다 */
  unreadPendingCount: number
  /** 승인 탭으로 이동하기 직전에 호출해, 해당 알림을 확인한 것으로 기록합니다 */
  onAcknowledgePurchaseNotifications: () => void
}

export default function ParentBellBoardSheet({
  open,
  onClose,
  unreadPendingCount,
  onAcknowledgePurchaseNotifications,
}: Props) {
  const router = useRouter()
  const [portalReady, setPortalReady] = useState(false)
  const [sheetEntered, setSheetEntered] = useState(false)

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
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
        <section
          className={`pointer-events-auto flex max-h-[min(85dvh,100vh-1rem)] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-2xl transition-transform duration-300 ease-out ${
            sheetEntered ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-200" aria-hidden />
          <div className="border-b border-gray-100 px-4 pb-2 pt-3">
            <p id="parent-bell-board-title" className="text-center text-sm font-black text-gray-900">
              알림 · 공지
            </p>
            <p className="mt-1 text-center text-[10px] leading-snug text-gray-500">
              처리할 알림과 안내 공지를 한곳에서 확인해요.
            </p>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {unreadPendingCount > 0 ? (
              <div>
                <p className="mb-2 px-0.5 text-[10px] font-black uppercase tracking-wide text-gray-500">알림</p>
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
                  <span className="shrink-0 text-lg font-bold text-gray-400" aria-hidden>
                    ›
                  </span>
                </Link>
              </div>
            ) : null}

            <div>
              <p className="mb-2 px-0.5 text-[10px] font-black uppercase tracking-wide text-gray-500">공지</p>
              <ul className="space-y-2">
                {PARENT_BELL_NOTICE_ITEMS.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        router.push(item.href)
                      }}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-left transition-colors hover:bg-gray-50"
                    >
                      <p className="text-xs font-extrabold text-gray-900">{item.title}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-gray-600">{item.summary}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  )

  if (!portalReady) return null
  return createPortal(overlay, document.body)
}
