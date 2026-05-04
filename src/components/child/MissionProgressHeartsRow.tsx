'use client'

/**
 * 오늘 미션 완주율(0~5)을 하트 5칸으로 표시합니다.
 *
 * 비개발자 설명:
 * - 미션 카드와 같은 하트 그림(`icons.png`)을 쓰고, 채워진 만큼 핑크, 남은 칸은 회색이에요.
 * - 한 칸이 새로 채워지면 그 칸만 잠깐 커졌다 돌아오는 연출이 납니다.
 * - 미션 완료 시 **애정 하트 파티클**이 이 줄의 가운데로 날아가므로 `ref`를 붙입니다.
 */

import { forwardRef, useLayoutEffect, useRef, useState } from 'react'
import SpriteImage from '@/components/common/SpriteImage'
import { ICONS } from '@/constants/sprites'

const DEFAULT_HEART_PX = 16

function MissionProgressHeart({
  filled,
  burst,
  sizePx,
}: {
  filled: boolean
  burst: boolean
  sizePx: number
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={burst && filled ? { animation: 'missionProgressHeartBurst 0.55s ease-out' } : undefined}
    >
      <SpriteImage
        sheet={ICONS}
        frame="heart"
        width={sizePx}
        clipRotated={false}
        className={
          filled ? 'shrink-0 select-none' : 'shrink-0 select-none grayscale opacity-[0.72]'
        }
      />
    </span>
  )
}

type Props = {
  filledHearts: number
  className?: string
  /** 한 칸 너비(px) — 헤더·레벨 카드 등 배치에 맞춰 조절 */
  heartSizePx?: number
}

const MissionProgressHeartsRow = forwardRef<HTMLDivElement, Props>(function MissionProgressHeartsRow(
  { filledHearts, className = '', heartSizePx = DEFAULT_HEART_PX },
  ref,
) {
  const prevFilled = useRef(filledHearts)
  const [burstIndex, setBurstIndex] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (filledHearts > prevFilled.current) {
      setBurstIndex(filledHearts - 1)
      const t = window.setTimeout(() => setBurstIndex(null), 650)
      prevFilled.current = filledHearts
      return () => clearTimeout(t)
    }
    prevFilled.current = filledHearts
    return undefined
  }, [filledHearts])

  return (
    <>
      <style>{`
        @keyframes missionProgressHeartBurst {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.55); filter: drop-shadow(0 0 4px #ff6fa3); }
          70%  { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
      `}</style>
      <div
        ref={ref}
        className={['flex gap-1', className].filter(Boolean).join(' ')}
        aria-label={`미션 완주 하트 ${filledHearts}/5`}
      >
        {Array.from({ length: 5 }, (_, i) => (
          <MissionProgressHeart
            key={i}
            filled={i < filledHearts}
            burst={burstIndex === i}
            sizePx={heartSizePx}
          />
        ))}
      </div>
    </>
  )
})

MissionProgressHeartsRow.displayName = 'MissionProgressHeartsRow'
export default MissionProgressHeartsRow
