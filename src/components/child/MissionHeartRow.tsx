'use client'

import { useEffect, useRef } from 'react'

interface MissionHeartRowProps {
  filledCount: number   // 0~5
  onFull?: () => void   // filledCount가 5가 됐을 때 호출 (하루 1회 게이트는 부모에서 관리)
}

function HeartIcon({ filled, animating }: { filled: boolean; animating: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={animating ? 'heart-fill-pop' : undefined}
      aria-hidden="true"
    >
      {filled ? (
        <>
          <defs>
            <linearGradient id="hfill" x1="9" y1="2" x2="9" y2="16" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ff6fa3" />
              <stop offset="100%" stopColor="#e8325a" />
            </linearGradient>
          </defs>
          <path
            d="M9 15.5C9 15.5 2 10.5 2 6C2 3.8 3.8 2 6 2C7.4 2 8.6 2.8 9 3.9C9.4 2.8 10.6 2 12 2C14.2 2 16 3.8 16 6C16 10.5 9 15.5 9 15.5Z"
            fill="url(#hfill)"
          />
        </>
      ) : (
        <path
          d="M9 15.5C9 15.5 2 10.5 2 6C2 3.8 3.8 2 6 2C7.4 2 8.6 2.8 9 3.9C9.4 2.8 10.6 2 12 2C14.2 2 16 3.8 16 6C16 10.5 9 15.5 9 15.5Z"
          fill="none"
          stroke="#d1aabb"
          strokeWidth="1.5"
        />
      )}
    </svg>
  )
}

export default function MissionHeartRow({ filledCount, onFull }: MissionHeartRowProps) {
  const prevFilledRef = useRef(filledCount)

  useEffect(() => {
    if (filledCount === 5 && prevFilledRef.current < 5) {
      onFull?.()
    }
    prevFilledRef.current = filledCount
  }, [filledCount, onFull])

  const hearts = Array.from({ length: 5 }, (_, i) => i)
  const justFilled = filledCount === 5

  return (
    <div
      className={`flex shrink-0 items-center gap-0.5 pr-0.5 ${justFilled ? 'hearts-celebrate' : ''}`}
      aria-label={`미션 하트 ${filledCount}/5`}
    >
      {hearts.map((i) => (
        <HeartIcon
          key={i}
          filled={i < filledCount}
          animating={i < filledCount && i === filledCount - 1}
        />
      ))}
    </div>
  )
}
