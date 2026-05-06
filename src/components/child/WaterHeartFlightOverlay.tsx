'use client'

/**
 * 물조리개 탭 시 하트가 화분 쪽으로 날아가는 잠깐 보이는 이펙트입니다.
 *
 * 비개발자 설명:
 * - 물조리개 버튼과 화분 박스의 화면 좌표를 재서, 그 사이로 작은 하트 여러 개가 날아갑니다.
 */

import type { CSSProperties, RefObject } from 'react'
import { useLayoutEffect, useState } from 'react'

type Burst = {
  id: number
  startX: number
  startY: number
  dx: number
  dy: number
}

type Props = {
  /** 값이 바뀔 때마다 한 번 발사합니다(보통 클릭할 때마다 +1). */
  trigger: number
  fromRef: RefObject<HTMLElement | null>
  toRef: RefObject<HTMLElement | null>
}

export default function WaterHeartFlightOverlay({ trigger, fromRef, toRef }: Props) {
  const [bursts, setBursts] = useState<Burst[]>([])

  useLayoutEffect(() => {
    if (!trigger) return

    let cleared = false
    let burstClearTimer = 0

    const shoot = () => {
      const from = fromRef.current
      const to = toRef.current
      if (!from || !to) return

      const a = from.getBoundingClientRect()
      const b = to.getBoundingClientRect()
      const fx = a.left + a.width / 2
      const fy = a.top + a.height / 2
      const tx = b.left + b.width / 2
      const ty = b.top + b.height / 2
      const dx = tx - fx
      const dy = ty - fy

      const parts = [0, 1, 2, 3, 4].map((i) => ({
        id: trigger * 20 + i,
        startX: fx + (i - 2) * 7,
        startY: fy + (i % 3) * 4,
        dx,
        dy,
      }))
      setBursts(parts)
      burstClearTimer = window.setTimeout(() => {
        if (!cleared) setBursts([])
      }, 900)
    }

    /** 레이아웃 직후 ref 가 붙도록 두 프레임 대기 */
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(shoot)
    })
    return () => {
      cleared = true
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      window.clearTimeout(burstClearTimer)
    }
  }, [trigger, fromRef, toRef])

  if (bursts.length === 0) return null

  return (
    <>
      <style>{`
        @keyframes waterHeartFly {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(var(--dx), var(--dy)) scale(0.35);
            opacity: 0.2;
          }
        }
      `}</style>
      {bursts.map((b) => (
        <span
          key={b.id}
          className="fixed z-[55] pointer-events-none text-xl leading-none select-none drop-shadow-md"
          style={
            {
              left: b.startX,
              top: b.startY,
              ['--dx' as string]: `${b.dx}px`,
              ['--dy' as string]: `${b.dy}px`,
              animation: `waterHeartFly 0.78s ease-in forwards`,
              animationDelay: `${(b.id % 5) * 0.045}s`,
            } as CSSProperties
          }
          aria-hidden
        >
          ❤️
        </span>
      ))}
    </>
  )
}
