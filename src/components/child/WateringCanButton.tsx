'use client'

/**
 * 물주기(하트 1 소모) 버튼입니다.
 *
 * 비개발자 설명:
 * - 하트가 없으면 빈 물조리개, 1개 이상이면 채워진 그림을 보여 줍니다.
 * - 탭하면 기울기 연출이 나오고, 부모(`PlantPot`)에서 물방울·성장 처리를 합니다.
 */

import { forwardRef, useRef, useState } from 'react'
import Image from 'next/image'
import type { PlantStage } from '@/constants/plantTrees'
import { WATERING_CAN_EMPTY_SRC, WATERING_CAN_FULL_SRC } from '@/constants/plantTrees'
import type { PlantHarvestCelebrate } from '@/lib/plantHarvest'
import type { WaterResult } from '@/hooks/usePlantPot'

type Props = {
  hearts: number
  disabled?: boolean
  onWater: () => Promise<WaterResult>
  onNoHearts: () => void
  allowWaterWithoutHearts?: boolean
  onGrowthCelebrate?: (newStage: PlantStage, harvest?: PlantHarvestCelebrate) => void
}

const WateringCanButton = forwardRef<HTMLButtonElement, Props>(function WateringCanButton(
  { hearts, disabled, onWater, onNoHearts, onGrowthCelebrate, allowWaterWithoutHearts = false },
  ref,
) {
  const [isPouring, setIsPouring] = useState(false)
  const [emptyShake, setEmptyShake] = useState(false)
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
    window.setTimeout(() => setIsPouring(false), 420)
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
          onGrowthCelebrate?.(result.newStage, result.harvest)
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
              ? 'canPourTilt 0.42s ease-out'
              : undefined,
        }}
        aria-label={canPour ? `물 주기 — 보유 하트 ${hearts}개` : '하트가 없어 물을 줄 수 없어요'}
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
