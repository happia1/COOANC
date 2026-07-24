'use client'

/**
 * 부모 앱 상단 설정(톱니)용 오버레이 시트입니다.
 * - 좁은 화면(모바일): 아래에서 올라오는 바텀 시트 — 뒤에 탭 화면이 비치도록 반투명 딤을 둡니다.
 * - md 이상(태블릿·PC 너비): 오른쪽에서 밀려 들어오는 패널 — 알림·공지 시트와 같은 UX 패턴입니다.
 */

import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import ParentSettingsPanelContent from '@/components/parent/ParentSettingsPanelContent'
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss'

type Props = {
  open: boolean
  onClose: () => void
}

export default function ParentSettingsSheet({ open, onClose }: Props) {
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
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby="parent-settings-sheet-title">
      {/** 반투명 배경 — 탭한 곳을 닫기로 처리해 홈·루틴 등 이전 화면이 그대로 보입니다 */}
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="설정 닫기" onClick={onClose} />
      {/*
        max-md: 하단 시트 / md+: 우측 패널 (태블릿 세로 포함해 너비 768px 이상이면 우측 슬라이드)
      */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center md:inset-x-0 md:inset-y-0 md:bottom-0 md:left-auto md:right-0 md:top-0 md:justify-end">
        <section
          className={`pointer-events-auto flex max-h-[min(92dvh,100vh-1rem)] w-full max-w-none flex-col rounded-t-2xl bg-gradient-to-b from-sky-100 via-white to-green-50 shadow-2xl transition-transform duration-300 ease-out md:h-full md:max-h-none md:w-full md:max-w-[420px] md:rounded-none md:rounded-l-2xl md:shadow-[-12px_0_40px_rgba(0,0,0,0.12)] ${
            sheetEntered
              ? 'translate-y-0 md:translate-y-0 md:translate-x-0'
              : 'translate-y-full md:translate-y-0 md:translate-x-full'
          }`}
          style={swipe.dragStyle}
        >
          {/** 모바일만 손잡이 막대 — 태블릿·PC 우측 패널에서는 숨김 */}
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-300/80 md:hidden" aria-hidden />
          <div className="shrink-0 touch-none border-b border-gray-200/80 px-4 pb-2 pt-3 md:pt-4" {...swipe.handleProps}>
            <p id="parent-settings-sheet-title" className="text-center text-sm font-black text-gray-900">
              설정
            </p>
            <p className="mt-1 text-center text-[10px] leading-snug text-gray-500">프로필과 알림을 관리해요.</p>
          </div>
          {/** 스크롤 영역 — 긴 설정 목록은 패널 안에서만 움직입니다 */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6 pt-2 md:px-4">
            <ParentSettingsPanelContent />
          </div>
        </section>
      </div>
    </div>
  )

  if (!portalReady) return null
  return createPortal(overlay, document.body)
}
