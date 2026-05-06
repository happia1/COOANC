'use client'

/**
 * 마켓 구매 요청 API 성공 직후: 구매 확인 팝업이 닫힌 뒤 짧게 뜨는 축하 레이어
 * - canvas-confetti + 배송 아이콘 하강 연출을 함께 사용
 * - 수 초 후 자동으로 닫힘
 */

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import SpriteImage from '@/components/common/SpriteImage'
import { SHOP_ANIMATIONS } from '@/constants/sprites'

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
      confetti({ particleCount: 110, spread: 78, startVelocity: 38, origin: { x: 0.5, y: 0.28 }, zIndex: 320 })
      window.setTimeout(() => {
        if (cancelled) return
        confetti({ particleCount: 70, spread: 100, startVelocity: 28, origin: { x: 0.32, y: 0.22 }, zIndex: 320 })
      }, 180)
      window.setTimeout(() => {
        if (cancelled) return
        confetti({ particleCount: 70, spread: 100, startVelocity: 28, origin: { x: 0.68, y: 0.22 }, zIndex: 320 })
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
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center px-5 py-10 sm:py-12"
      role="dialog"
      aria-modal="true"
      aria-labelledby="market-success-title"
    >
      <style>{`
        @keyframes successBalloonDrop {
          0% { transform: translateX(-50%) translateY(-170px) rotate(-3deg) scale(0.95); opacity: 0; }
          10% { opacity: 1; }
          25% { transform: translateX(-50%) translateY(-120px) rotate(-2.7deg) scale(0.96); }
          50% { transform: translateX(-50%) translateY(-58px) rotate(-2.1deg) scale(0.975); }
          75% { transform: translateX(-50%) translateY(-8px) rotate(-1.1deg) scale(0.99); }
          100% { transform: translateX(-50%) translateY(18px) rotate(0deg) scale(1); opacity: 1; }
        }
      `}</style>
      <div className="absolute inset-0 bg-black/45" aria-hidden />
      {/** 오토바이 대신 열기구가 하늘하늘 내려오는 연출 */}
      <div
        className="pointer-events-none absolute left-1/2 top-[calc(50%-220px)] z-[325] drop-shadow-xl"
        style={{ animation: 'successBalloonDrop 2.35s cubic-bezier(0.22, 0.8, 0.28, 1) forwards' }}
      >
        <SpriteImage sheet={SHOP_ANIMATIONS} frame="reward" width={92} clipRotated={false} />
      </div>

      <div className="relative z-[310] my-auto w-full max-w-sm rounded-3xl bg-white px-6 pb-7 pt-8 text-center shadow-2xl ring-1 ring-black/[0.06]">
        <p id="market-success-title" className="text-2xl font-black leading-snug text-brand-blue sm:text-3xl">
          구매완료!
        </p>
        <p className="mt-3 text-base font-bold leading-snug text-brand-text sm:text-lg">
          조금만 기다려주세요.
          <br />
          부모님이 선물을 주실거에요.
        </p>
      </div>
    </div>,
    document.body,
  )
}
