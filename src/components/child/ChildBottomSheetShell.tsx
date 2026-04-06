'use client'

import { useEffect, useState, type ReactNode } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  /** 스크린리더용 제목 id(자식에 id 연결) */
  titleId: string
  children: ReactNode
  /** true 이멀 상단 핸들 막대 숨김·팝업을 더 크게(곰돌이 판 전용) */
  compact?: boolean
}

/**
 * 자녀 화면 공통 바텀시트 껍데기(딤 + 아래에서 슬라이드 + 핸들 막대)
 */
export default function ChildBottomSheetShell({
  open,
  onClose,
  titleId,
  children,
  compact = false,
}: Props) {
  const [mounted, setMounted] = useState(false)
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const id = requestAnimationFrame(() => setEntered(true))
      return () => cancelAnimationFrame(id)
    }
    setEntered(false)
    const t = window.setTimeout(() => setMounted(false), 280)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!mounted) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mounted])

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-[100] mx-auto w-full max-w-md" role="dialog" aria-modal aria-labelledby={titleId}>
      <button
        type="button"
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${entered ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-label="닫기"
      />

      <div
        className={`absolute bottom-0 left-0 right-0 flex flex-col rounded-t-3xl bg-gradient-to-b from-sky-100 via-white to-white shadow-[0_-8px_32px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out ${
          compact ? 'max-h-[96vh]' : 'max-h-[88vh]'
        } ${entered ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {!compact && (
          <div className="flex shrink-0 flex-col items-center pb-1 pt-2">
            <div className="h-1.5 w-10 rounded-full bg-gray-300" aria-hidden />
          </div>
        )}
        {compact && <div className="h-1 shrink-0" aria-hidden />}
        {children}
      </div>
    </div>
  )
}
