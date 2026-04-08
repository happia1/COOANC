'use client'

import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

type NoticeItem = {
  id: string
  title: string
  summary: string
  href: string
}

type Props = {
  open: boolean
  onClose: () => void
}

/**
 * 부모 상단바용 공지 슬라이드 팝업
 * - notice 아이콘을 누르면 아래에서 위로 올라오는 시트로 열립니다.
 * - 항목을 누르면 해당 화면으로 이동합니다.
 */
export default function ParentNoticeSlideSheet({ open, onClose }: Props) {
  const router = useRouter()
  const [portalReady, setPortalReady] = useState(false)
  const [sheetEntered, setSheetEntered] = useState(false)

  /**
   * 데모/초기 공지 데이터
   * - 실제 서비스 데이터가 연결되면 API 결과로 바꾸기 쉽도록 배열로 관리합니다.
   */
  const noticeItems: NoticeItem[] = [
    {
      id: 'notice-routine',
      title: '루틴 알림 점검 안내',
      summary: '루틴 알람 설정을 확인해 주세요.',
      href: '/parent/routine',
    },
    {
      id: 'notice-approval',
      title: '새 승인 요청이 있어요',
      summary: '자녀의 미션 승인 요청을 확인해 주세요.',
      href: '/parent/approval',
    },
    {
      id: 'notice-home',
      title: '이번 주 주요 공지',
      summary: '홈에서 이번 주 공지사항을 확인해 주세요.',
      href: '/parent/home',
    },
    {
      id: 'notice-system',
      title: '시스템 점검 공지',
      summary: '설정 화면에서 점검 일정을 확인할 수 있어요.',
      href: '/settings',
    },
  ]

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
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby="parent-notice-sheet-title">
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="공지 닫기" onClick={onClose} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
        <section
          className={`pointer-events-auto flex max-h-[min(80dvh,100vh-1rem)] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-2xl transition-transform duration-300 ease-out ${
            sheetEntered ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-200" aria-hidden />
          <div className="border-b border-gray-100 px-4 pb-2 pt-3">
            <p id="parent-notice-sheet-title" className="text-center text-sm font-black text-gray-900">
              주요 공지
            </p>
            <p className="mt-1 text-center text-[10px] leading-snug text-gray-500">
              팝업/알림/시스템 공지사항을 한 곳에서 확인해요.
            </p>
          </div>

          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
            {noticeItems.map((item) => (
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
        </section>
      </div>
    </div>
  )

  if (!portalReady) return null
  return createPortal(overlay, document.body)
}
