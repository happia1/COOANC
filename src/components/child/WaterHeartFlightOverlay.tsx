'use client'

/**
 * 물조리개 탭 시 하트가 화분 쪽으로 날아가는 잠깐 보이는 이펙트입니다.
 *
 * 비개발자 설명:
 * - 물조리개 버튼과 화분 박스의 화면 좌표를 재서, 그 사이로 작은 하트 여러 개가 날아갑니다.
 */

import type { CSSProperties, RefObject } from 'react'
import { useLayoutEffect, useState } from 'react'
import SpriteImage from '@/components/common/SpriteImage'
import { ICONS } from '@/constants/sprites'

type Burst = {
  id: number
  startX: number
  startY: number
  dx: number
  dy: number
  arc: number
}

type Sparkle = {
  id: number
  x: number
  y: number
  dx: number
  dy: number
  size: number
}

type Props = {
  /** 값이 바뀔 때마다 한 번 발사합니다(보통 클릭할 때마다 +1). */
  trigger: number
  fromRef: RefObject<HTMLElement | null>
  toRef: RefObject<HTMLElement | null>
}

export default function WaterHeartFlightOverlay({ trigger, fromRef, toRef }: Props) {
  const [bursts, setBursts] = useState<Burst[]>([])
  const [sparkles, setSparkles] = useState<Sparkle[]>([])

  useLayoutEffect(() => {
    if (!trigger) return

    let cleared = false
    let burstClearTimer = 0
    let sparkleStartTimer = 0
    let sparkleClearTimer = 0

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

      // 요청사항: 하트 1개가 포물선으로 화분까지 날아갑니다.
      const parts = [
        {
          id: trigger * 100 + 1,
          startX: fx,
          startY: fy,
          dx,
          dy,
          arc: Math.min(68, Math.max(34, Math.abs(dx) * 0.22 + 18)),
        },
      ]
      setBursts(parts)

      // 도착 지점에서 반짝임 파티클이 터지도록 예약
      sparkleStartTimer = window.setTimeout(() => {
        if (cleared) return
        const cx = tx
        const cy = ty
        const s = Array.from({ length: 8 }, (_, i) => {
          const angle = (Math.PI * 2 * i) / 8
          const distance = 12 + (i % 3) * 8
          return {
            id: trigger * 100 + 20 + i,
            x: cx,
            y: cy,
            dx: Math.cos(angle) * distance,
            dy: Math.sin(angle) * distance,
            size: 8 + (i % 2) * 4,
          }
        })
        setSparkles(s)
      }, 620)

      sparkleClearTimer = window.setTimeout(() => {
        if (!cleared) setSparkles([])
      }, 1080)

      burstClearTimer = window.setTimeout(() => {
        if (!cleared) setBursts([])
      }, 760)
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
      window.clearTimeout(sparkleStartTimer)
      window.clearTimeout(sparkleClearTimer)
      setSparkles([])
    }
  }, [trigger, fromRef, toRef])

  if (bursts.length === 0 && sparkles.length === 0) return null

  return (
    <>
      <style>{`
        @keyframes waterHeartFlyArc {
          0% {
            transform: translate(0px, 0px) scale(1) rotate(-8deg);
            opacity: 1;
          }
          58% {
            transform:
              translate(calc(var(--dx) * 0.58), calc(var(--dy) * 0.58 - var(--arc)))
              scale(1.08)
              rotate(8deg);
            opacity: 1;
          }
          100% {
            transform: translate(var(--dx), var(--dy)) scale(0.92) rotate(0deg);
            opacity: 0.96;
          }
        }
        @keyframes waterHeartSparkleBurst {
          0% {
            transform: translate(0, 0) scale(0.9);
            opacity: 0.95;
          }
          100% {
            transform: translate(var(--sx), var(--sy)) scale(0.2);
            opacity: 0;
          }
        }
      `}</style>
      {bursts.map((b) => (
        <span
          key={b.id}
          className="fixed z-[56] pointer-events-none select-none drop-shadow-[0_2px_6px_rgba(255,85,120,0.35)]"
          style={
            {
              left: b.startX - 10,
              top: b.startY - 10,
              ['--dx' as string]: `${b.dx}px`,
              ['--dy' as string]: `${b.dy}px`,
              ['--arc' as string]: `${b.arc}px`,
              animation: 'waterHeartFlyArc 0.66s cubic-bezier(0.22, 0.9, 0.2, 1) forwards',
            } as CSSProperties
          }
          aria-hidden
        >
          <SpriteImage
            sheet={ICONS}
            frame="heart"
            width={20}
            clipRotated={false}
            className="h-5 w-5 object-contain"
          />
        </span>
      ))}
      {sparkles.map((s) => (
        <span
          key={s.id}
          className="fixed z-[57] pointer-events-none select-none"
          style={
            {
              left: s.x - s.size / 2,
              top: s.y - s.size / 2,
              width: s.size,
              height: s.size,
              fontSize: s.size,
              lineHeight: 1,
              ['--sx' as string]: `${s.dx}px`,
              ['--sy' as string]: `${s.dy}px`,
              animation: `waterHeartSparkleBurst 0.46s ease-out ${(s.id % 3) * 0.03}s forwards`,
            } as CSSProperties
          }
          aria-hidden
        >
          ✨
        </span>
      ))}
    </>
  )
}
