'use client'

import { useEffect, useState, type ReactNode } from 'react'

/** 항해 지도 시트가 아래에서 올라오는 시간(ms) — 값을 키울수록 더 천천히 올라옵니다 */
const SHEET_ENTER_MS = 1050

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
 * - 지도(항해지도)를 열 때 패널이 **아래에서 천천히** 올라오도록 `SHEET_ENTER_MS` 로 속도를 맞춥니다.
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
      /** 바깥·안쪽 rAF 둘 다 취소해야, 빠르게 닫았을 때 열림 상태가 뒤늦게 켜지지 않습니다 */
      let innerRaf = 0
      const outerRaf = requestAnimationFrame(() => {
        innerRaf = requestAnimationFrame(() => setEntered(true))
      })
      return () => {
        cancelAnimationFrame(outerRaf)
        cancelAnimationFrame(innerRaf)
      }
    }
    setEntered(false)
    /**
     * 아래 `SHEET_ENTER_MS` 와 같게: 패널이 화면 밖으로 내려간 뒤에만 언마운트해야
     * 닫기 애니메이션이 끊기지 않습니다.
     */
    const t = window.setTimeout(() => setMounted(false), SHEET_ENTER_MS + 80)
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
        className={`absolute inset-0 bg-black/40 transition-opacity ease-out ${
          entered ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ transitionDuration: `${Math.round(SHEET_ENTER_MS * 0.92)}ms` }}
        onClick={onClose}
        aria-label="닫기"
      />

      <div
        className={`absolute bottom-0 left-0 right-0 flex flex-col rounded-t-3xl bg-gradient-to-b from-sky-100 via-white to-white shadow-[0_-8px_32px_rgba(0,0,0,0.12)] transition-transform ease-[cubic-bezier(0.33,0.02,0.2,1)] ${
          compact ? 'max-h-[96vh]' : 'max-h-[88vh]'
        } ${entered ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ transitionDuration: `${SHEET_ENTER_MS}ms` }}
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
