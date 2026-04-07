'use client'

/**
 * 마켓 구매 요청 API 성공 직후: 구매 확인 팝업이 닫힌 뒤 짧게 뜨는 축하 레이어
 * - canvas-confetti 로 콘페티
 * - `animations.png` 스프라이트의 reward(선물 상자) + 낙하산 이모지로 위에서 내려오는 연출
 * - 본문 카드는 그 아래, 낙하산·택배가 카드 위쪽으로 살짝 겹치도록 배치
 * - 수 초 후 자동으로 닫힘
 */

import { useEffect, useRef } from 'react'
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
  autoCloseMs = 5200,
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

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        {/*
          z-20: 카드(z-10)보다 위 — 낙하산·상자가 흰 팝업 위로 올라온 것처럼 보이게
        */}
        <div className="relative z-20 -mb-6 flex flex-col items-center sm:-mb-8">
          <div className="animate-market-parachute flex flex-col items-center">
            <span className="text-[2.75rem] leading-none drop-shadow-md" aria-hidden>
              🪂
            </span>
            <div className="market-parcel-sway-wrap -mt-0.5 drop-shadow-xl">
              <SpriteImage sheet={SHOP_ANIMATIONS} frame="reward" width={108} clipRotated={false} />
            </div>
          </div>
        </div>

        <div className="relative z-10 w-full rounded-3xl bg-white px-6 pb-7 pt-9 text-center shadow-2xl ring-1 ring-black/[0.06]">
          <p id="market-success-title" className="text-xl font-black leading-snug text-brand-text sm:text-2xl">
            축하드립니다.
          </p>
          <p className="mt-3 text-lg font-black leading-snug text-brand-blue sm:text-xl">구매가 완료되었어요!</p>
          <p className="mt-4 text-sm font-bold leading-relaxed text-gray-500">
            승인을 요청했으니
            <br />
            잠시만 기다려주세요!
          </p>
        </div>
      </div>
    </div>
  )
}
