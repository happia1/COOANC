'use client'

import { useEffect, useState } from 'react'

type Piece = { id: number; left: number; delay: number; color: string; dur: number; rot: number }

/**
 * 칭찬 스티커 도착 팝업 위에 잠깐 터지는 가벼운 컨페티(순수 CSS 애니메이션).
 */
export default function PraiseGiftConfetti({ active }: { active: boolean }) {
  const [pieces, setPieces] = useState<Piece[]>([])

  useEffect(() => {
    if (!active) {
      setPieces([])
      return
    }
    const colors = ['#F472B6', '#FBBF24', '#60A5FA', '#A78BFA', '#34D399', '#FB7185']
    setPieces(
      Array.from({ length: 48 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.35,
        color: colors[i % colors.length]!,
        dur: 2.2 + Math.random() * 1.2,
        rot: Math.random() * 360,
      })),
    )
  }, [active])

  if (!active || pieces.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[115] overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 h-2.5 w-2 rounded-[2px] opacity-90 shadow-sm"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            transform: `rotate(${p.rot}deg)`,
            animation: `praise-confetti-fall ${p.dur}s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  )
}
