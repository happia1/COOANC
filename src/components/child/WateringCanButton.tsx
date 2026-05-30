'use client'

/**
 * 물주기(하트 1 소모) 버튼입니다.
 *
 * 비개발자 설명:
 * - 하트가 없으면 빈 물조리개(`200.png`), 1개 이상이면 채워진 그림(`300.png`)을 보여 줍니다.
 * - 탭하면 바로 기울기·떨림 연출이 나오고, 하트가 있으면 화분 쪽 이펙트는 부모(`PlantPot`)가 즉시 띄웁니다.
 */

import { forwardRef, useRef, useState } from 'react'
import Image from 'next/image'
import type { PlantStage } from '@/constants/plantTrees'
import type { WaterResult } from '@/hooks/usePlantPot'

/** 하트 없음 — 빈 물조리개 */
const WATERING_CAN_EMPTY_SRC = '/assets/img/missions/routine/plant/200.png' as const
/** 하트 1개 이상 — 물 줄 수 있는 물조리개 */
const WATERING_CAN_FULL_SRC = '/assets/img/missions/routine/plant/300.png' as const

type Props = {
  hearts: number
  disabled?: boolean
  onWater: () => Promise<WaterResult>
  onNoHearts: () => void
  /**
   * true면 보유 하트가 0이어도 `onWater` 를 호출합니다(7단계 완성 후 화분만 씨앗으로 돌리는 등).
   */
  allowWaterWithoutHearts?: boolean
  /** 한 단계(또는 최종 7단계) 성장 직후 — 팝업·콘페티는 부모에서 처리 */
  onGrowthCelebrate?: (newStage: PlantStage) => void
}

const WateringCanButton = forwardRef<HTMLButtonElement, Props>(function WateringCanButton(
  { hearts, disabled, onWater, onNoHearts, onGrowthCelebrate, allowWaterWithoutHearts = false },
  ref,
) {
  /** 물줄 때 기울기 모션 */
  const [isPouring, setIsPouring] = useState(false)
  /** 하트 부족 시 빈 물조리개 떨림 모션 */
  const [emptyShake, setEmptyShake] = useState(false)
  /** 연속 탭으로 API가 겹치지 않게만 막습니다(버튼 비활성화·긴 busy 는 쓰지 않음) */
  const inFlightRef = useRef(false)

  const canPour = hearts > 0 || allowWaterWithoutHearts
  const imageSrc = canPour ? WATERING_CAN_FULL_SRC : WATERING_CAN_EMPTY_SRC

  function handleClick() {
    if (disabled || inFlightRef.current) return

    if (!canPour) {
      setEmptyShake(true)
      onNoHearts()
      window.setTimeout(() => setEmptyShake(false), 420)
      return
    }

    setIsPouring(true)
    window.setTimeout(() => setIsPouring(false), 280)
    inFlightRef.current = true

    void onWater()
      .then((result) => {
        if (result === 'no_hearts') {
          setEmptyShake(true)
          onNoHearts()
          window.setTimeout(() => setEmptyShake(false), 420)
          return
        }
        if (typeof result === 'object' && result.type === 'grew') {
          onGrowthCelebrate?.(result.newStage)
        }
      })
      .finally(() => {
        inFlightRef.current = false
      })
  }

  return (
    <>
      <style>{`
        @keyframes canPourTilt {
          0%   { transform: rotate(0deg) scale(1); }
          35%  { transform: rotate(-14deg) scale(0.95); }
          100% { transform: rotate(0deg) scale(1); }
        }
        @keyframes canEmptyShake {
          0%   { transform: rotate(0deg) translateX(0); }
          20%  { transform: rotate(-7deg) translateX(-1px); }
          40%  { transform: rotate(7deg) translateX(1px); }
          60%  { transform: rotate(-6deg) translateX(-1px); }
          80%  { transform: rotate(6deg) translateX(1px); }
          100% { transform: rotate(0deg) translateX(0); }
        }
      `}</style>
      <button
        ref={ref}
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="relative flex shrink-0 origin-bottom items-center justify-center overflow-visible border-0 bg-transparent p-0 transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-50"
        style={{
          animation: emptyShake
            ? 'canEmptyShake 0.42s ease-in-out'
            : isPouring
              ? 'canPourTilt 0.28s ease-out'
              : undefined,
        }}
        aria-label={
          canPour ? `물 주기 — 보유 하트 ${hearts}개` : '하트가 없어 물을 줄 수 없어요'
        }
      >
        <div className="relative shrink-0 overflow-visible" style={{ width: 32, height: 32 }}>
          <Image
            src={imageSrc}
            alt={canPour ? '물조리개' : '빈 물조리개'}
            fill
            className="object-contain"
            sizes="96px"
            priority
          />
        </div>
      </button>
    </>
  )
})

WateringCanButton.displayName = 'WateringCanButton'

export default WateringCanButton
