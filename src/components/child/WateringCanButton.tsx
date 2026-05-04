'use client'

/**
 * 물주기(하트 1 소모) 버튼입니다.
 *
 * 비개발자 설명:
 * - 탭하면 실제로 하트 1개를 써서 화분 진행도를 올립니다.
 * - 보유 하트 구간에 따라 물조리개 그림이 바뀝니다(100 / 200 / 300 PNG).
 */

import { useState } from 'react'
import Image from 'next/image'
import { getWateringCanImage } from '@/constants/plantTrees'
import type { WaterResult } from '@/hooks/usePlantPot'

type Props = {
  hearts: number
  disabled?: boolean
  onWater: () => Promise<WaterResult>
  /** 하트 0개일 때 — 바깥에서 말풍선 등 표시 */
  onNoHearts: () => void
  /** 7단계 완성 직후 */
  onCompleted: () => void
  /** 단계가 한 칸 올라갔을 때(선택) */
  onLevelUp?: () => void
  /**
   * false면 물조리개 아래 ❤️·숫자 줄을 숨깁니다.
   * 비개발자: 타이머·장바구니와 한 줄로만 맞출 때 씁니다.
   */
  showHeartRow?: boolean
}

export default function WateringCanButton({
  hearts,
  disabled,
  onWater,
  onNoHearts,
  onCompleted,
  onLevelUp,
  showHeartRow = true,
}: Props) {
  const [pouring, setPouring] = useState(false)
  const canImg = getWateringCanImage(hearts)

  async function handleClick() {
    if (pouring || disabled) return
    setPouring(true)
    try {
      const result = await onWater()
      if (result === 'no_hearts') onNoHearts()
      else if (result === 'completed') onCompleted()
      else if (result === 'leveled_up') onLevelUp?.()
    } finally {
      window.setTimeout(() => setPouring(false), 500)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || pouring}
      className={
        showHeartRow
          ? 'flex flex-col items-center gap-0.5 transition-transform active:scale-90 disabled:opacity-50'
          : 'flex h-14 w-14 shrink-0 items-center justify-center border-0 bg-transparent p-0 transition-transform active:scale-90 disabled:opacity-50'
      }
      aria-label={`물 주기 — 보유 하트 ${hearts}개`}
    >
      {/* 물조리개 — 타이머·장바구니와 동일하게 아이콘 영역 48×48px */}
      <div
        className={`relative h-12 w-12 transition-transform ${pouring ? 'scale-75 rotate-12' : ''}`}
      >
        <Image src={canImg} alt="물조리개" fill className="object-contain" sizes="48px" priority />
      </div>
      {showHeartRow ? (
        <div className="flex items-center gap-0.5">
          <span className="text-[10px]" aria-hidden>
            ❤️
          </span>
          <span className="text-[10px] font-black text-pink-400">{hearts}</span>
        </div>
      ) : null}
    </button>
  )
}
