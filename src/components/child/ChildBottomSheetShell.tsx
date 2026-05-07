'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/** 항해 지도 시트가 아래에서 올라오는 시간(ms) — 값을 키울수록 더 천천히 올라옵니다 */
const SHEET_ENTER_MS = 1050

/** 핸들을 아래로 이 정도(px) 이상 끌면 닫기로 인식합니다 */
const SWIPE_CLOSE_PX = 56

type Props = {
  open: boolean
  onClose: () => void
  /** 스크린리더용 제목 id(자식에 id 연결) */
  titleId: string
  children: ReactNode
  /** true 이멀 상단 핸들 막대 숨김·팝업을 더 크게(곰돌이 판 전용) */
  compact?: boolean
  /**
   * true: 상단 핸들 영역을 아래로 스와이프하면 시트를 닫습니다(모바일 제스처).
   * 스크롤 본문과 구분하기 위해 **핸들 줄**에서만 동작합니다.
   */
  swipeToClose?: boolean
}

/**
 * 자녀 화면 공통 시트 껍데기(딤 + 슬라이드)
 * - 세로·좁은 가로: 아래에서 슬라이드 + 핸들 막대(시트 가로는 뷰포트 전폭).
 * - 패드 가로(md+landscape): 오른쪽 전체 높이 패널로 슬라이드(다른 부모·자녀 시트와 통일).
 * - 지도(항해지도)는 `SHEET_ENTER_MS` 로 천천히 올라오도록 속도를 맞춥니다.
 */
export default function ChildBottomSheetShell({
  open,
  onClose,
  titleId,
  children,
  compact = false,
  swipeToClose = false,
}: Props) {
  const [mounted, setMounted] = useState(false)
  const [entered, setEntered] = useState(false)
  /** 스와이프 닫기: 포인터 시작 Y (핸들 전용) */
  const swipeStartY = useRef<number | null>(null)

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
    <div
      className="fixed inset-0 z-[100] w-full"
      role="dialog"
      aria-modal
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className={`absolute inset-0 bg-black/40 transition-opacity ease-out ${
          entered ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ transitionDuration: `${Math.round(SHEET_ENTER_MS * 0.92)}ms` }}
        onClick={onClose}
        aria-label="닫기"
      />

      {/*
        모바일에서 잘리는 문제 완화:
        - `dvh` 로 주소창 등으로 뷰포트 높이가 바뀔 때도 기준을 맞춤
        - `min-h-0` + 안쪽 `overflow-hidden` 으로 flex 자식이 스크롤 영역까지 높이를 넘기도록 함
      */}
      <div
        className={`absolute bottom-0 left-0 right-0 flex min-h-0 flex-col overflow-hidden rounded-t-3xl bg-gradient-to-b from-sky-100 via-white to-white pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_32px_rgba(0,0,0,0.12)] transition-transform ease-[cubic-bezier(0.33,0.02,0.2,1)] md:landscape:bottom-0 md:landscape:top-0 md:landscape:left-auto md:landscape:right-0 md:landscape:h-full md:landscape:max-h-none md:landscape:w-full md:landscape:max-w-[420px] md:landscape:rounded-none md:landscape:rounded-l-3xl md:landscape:shadow-[-8px_0_32px_rgba(0,0,0,0.12)] ${
          compact ? 'max-h-[min(96dvh,100dvh)]' : 'max-h-[min(88dvh,100dvh)]'
        } ${
          entered
            ? 'translate-y-0 md:landscape:translate-y-0 md:landscape:translate-x-0'
            : 'translate-y-full md:landscape:translate-y-0 md:landscape:translate-x-full'
        }`}
        style={{ transitionDuration: `${SHEET_ENTER_MS}ms` }}
      >
        {!compact && (
          <div
            className={`flex shrink-0 flex-col items-center pb-2 pt-3 md:landscape:hidden ${swipeToClose ? 'touch-none select-none' : ''}`}
            onPointerDown={
              swipeToClose
                ? (e) => {
                    swipeStartY.current = e.clientY
                    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                  }
                : undefined
            }
            onPointerUp={
              swipeToClose
                ? (e) => {
                    const start = swipeStartY.current
                    swipeStartY.current = null
                    try {
                      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
                    } catch {
                      /* 캡처가 없으면 무시 */
                    }
                    if (start == null) return
                    if (e.clientY - start >= SWIPE_CLOSE_PX) onClose()
                  }
                : undefined
            }
            onPointerCancel={
              swipeToClose
                ? () => {
                    swipeStartY.current = null
                  }
                : undefined
            }
          >
            <div className="h-1.5 w-10 rounded-full bg-gray-300" aria-hidden />
          </div>
        )}
        {compact && <div className="h-1 shrink-0" aria-hidden />}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  )
}
