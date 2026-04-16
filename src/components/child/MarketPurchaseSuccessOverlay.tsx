'use client'

/**
 * 마켓 구매 요청 API 성공 직후: 구매 확인 팝업이 닫힌 뒤 짧게 뜨는 축하 레이어
 * - canvas-confetti 로 콘페티만 사용 (낙하산·별도 승인 안내 문구는 두지 않음 — 토스트와 겹침 방지)
 * - 수 초 후 자동으로 닫힘
 */

import { useEffect, useRef } from 'react'

type Props = {
  open: boolean
  /** 자동 닫힘 후 부모 state 정리 */
  onDismiss: () => void
  /** 자동 닫힘까지 ms */
  autoCloseMs?: number
}

export default function MarketPurchaseSuccessOverlay({
  open,
  onDismiss,
  autoCloseMs = 2800,
}: Props) {
  const confettiFired = useRef(false)

  useEffect(() => {
    if (!open) {
      confettiFired.current = false
      return
    }
    if (confettiFired.current) return
    confettiFired.current = true

    let cancelled = false
    void import('canvas-confetti').then((mod) => {
      if (cancelled) return
      const confetti = mod.default
      confetti({ particleCount: 110, spread: 78, startVelocity: 38, origin: { x: 0.5, y: 0.28 } })
      window.setTimeout(() => {
        if (cancelled) return
        confetti({ particleCount: 70, spread: 100, startVelocity: 28, origin: { x: 0.32, y: 0.22 } })
      }, 180)
      window.setTimeout(() => {
        if (cancelled) return
        confetti({ particleCount: 70, spread: 100, startVelocity: 28, origin: { x: 0.68, y: 0.22 } })
      }, 320)
    })

    const t = window.setTimeout(() => {
      onDismiss()
    }, autoCloseMs)

    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [open, onDismiss, autoCloseMs])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="market-success-title"
    >
      <div className="absolute inset-0 bg-black/45" aria-hidden />

      <div className="relative z-10 w-full max-w-sm rounded-3xl bg-white px-6 pb-7 pt-8 text-center shadow-2xl ring-1 ring-black/[0.06]">
        <p id="market-success-title" className="text-xl font-black leading-snug text-brand-text sm:text-2xl">
          축하드립니다.
        </p>
        <p className="mt-3 text-lg font-black leading-snug text-brand-blue sm:text-xl">구매가 완료되었어요!</p>
      </div>
    </div>
  )
}
