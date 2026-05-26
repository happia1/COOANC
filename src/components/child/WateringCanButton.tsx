'use client'

/**
 * 물주기(하트 1 소모) 버튼입니다.
 *
 * 비개발자 설명:
 * - 탭하면 보유 하트 1개를 써서 화분 진행도를 올립니다.
 * - 하트 개수는 레벨 카드 안에 표시되므로 여기에는 **물조리개 그림만** 둡니다.
 * - 탭하는 순간 물조리개가 살짝 기울어 보이며, 부모에서 하트가 화분으로 날아가는 효과를 띄웁니다(`onPourVisual`).
 * - 물조리개 그림은 하트 수와 상관없이 한 장(`300.png`)으로 고정합니다.
 */

import { forwardRef, useState } from 'react'
import Image from 'next/image'
import type { PlantStage } from '@/constants/plantTrees'
import type { WaterResult } from '@/hooks/usePlantPot'

/** 물조리개 PNG — 하트 수와 무관하게 같은 그림을 씁니다 */
const WATERING_CAN_IMAGE_SRC = '/assets/img/missions/routine/plant/300.png' as const

type Props = {
  hearts: number
  disabled?: boolean
  onWater: () => Promise<WaterResult>
  onNoHearts: () => void
  /**
   * true면 보유 하트가 0이어도 `onWater` 를 호출합니다(7단계 완성 후 화분만 씨앗으로 돌리는 등).
   * 비개발자: 열매가 다 익은 뒤에는 하트가 없어도 한 번 탭하면 나무가 다시 씨앗부터 시작해요.
   */
  allowWaterWithoutHearts?: boolean
  /**
   * 한 단계(또는 최종 7단계) 성장 직후 — 팝업·콘페티는 부모에서 처리.
   * 비개발자: 물을 준 뒤 화분 그림이 바뀌는 단계에 도달하면 여기로 알려 줍니다.
   */
  onGrowthCelebrate?: (newStage: PlantStage) => void
  /** 탭 직후 — 하트가 화분으로 날아가는 시각 효과용 */
  onPourVisual?: () => void
}

const WateringCanButton = forwardRef<HTMLButtonElement, Props>(function WateringCanButton(
  { hearts, disabled, onWater, onNoHearts, onGrowthCelebrate, onPourVisual, allowWaterWithoutHearts = false },
  ref,
) {
  const [busy, setBusy] = useState(false)
  /** 물줄 때 기울기 모션(하트 충분할 때만) */
  const [isPouring, setIsPouring] = useState(false)
  /** 하트 부족 시 빈 물조리개 떨림 모션 */
  const [emptyShake, setEmptyShake] = useState(false)

  async function handleClick() {
    if (busy || disabled) return
    if (hearts <= 0 && !allowWaterWithoutHearts) {
      setEmptyShake(true)
      onNoHearts()
      window.setTimeout(() => setEmptyShake(false), 420)
      return
    }
    setBusy(true)
    setIsPouring(true)
    window.setTimeout(() => setIsPouring(false), 280)
    try {
      const result = await onWater()
      if (result === 'no_hearts') {
        /** 서버/상태 타이밍으로 하트 부족이 뒤늦게 확인된 경우도 떨림만 처리 */
        setEmptyShake(true)
        onNoHearts()
        window.setTimeout(() => setEmptyShake(false), 420)
      } else {
        /** 하트가 실제로 소모될 때만 하트 1개 포물선 비행 이펙트 발사 */
        onPourVisual?.()
      }
      if (typeof result === 'object' && result.type === 'grew') {
        onGrowthCelebrate?.(result.newStage)
      }
    } finally {
      window.setTimeout(() => setBusy(false), 420)
    }
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
        onClick={() => void handleClick()}
        disabled={disabled || busy}
        className="relative flex shrink-0 origin-bottom items-center justify-center overflow-visible border-0 bg-transparent p-0 transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-50"
        style={{
          animation: emptyShake
            ? 'canEmptyShake 0.42s ease-in-out'
            : isPouring
              ? 'canPourTilt 0.28s ease-out'
              : undefined,
        }}
        aria-label={`물 주기 — 보유 하트 ${hearts}개`}
      >
        <div className="relative shrink-0 overflow-visible" style={{ width: 32, height: 32 }}>
          {/**
           * 비개발자 설명:
           * - 화면에서는 부모 `scale()`로 32px보다 크게 보일 수 있습니다.
           * - `sizes`를 너무 작게(32px) 주면 저해상도 원본을 선택해 확대 시 흐릿해질 수 있어,
           *   최대 표시 크기를 고려한 값(96px)으로 올려 선명도를 유지합니다.
           */}
          <Image src={WATERING_CAN_IMAGE_SRC} alt="물조리개" fill className="object-contain" sizes="96px" priority />
        </div>
      </button>
    </>
  )
})

WateringCanButton.displayName = 'WateringCanButton'

export default WateringCanButton
