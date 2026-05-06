'use client'

/**
 * 물주기(하트 1 소모) 버튼입니다.
 *
 * 비개발자 설명:
 * - 탭하면 보유 하트 1개를 써서 화분 진행도를 올립니다.
 * - 하트 개수는 레벨 카드 안에 표시되므로 여기에는 **물조리개 그림만** 둡니다.
 * - 탭하는 순간 물조리개가 살짝 기울어 보이며, 부모에서 하트가 화분으로 날아가는 효과를 띄웁니다(`onPourVisual`).
 * - 하트 구간에 따라 물조리개 PNG 가 바뀝니다(100 / 200 / 300).
 */

import { forwardRef, useState } from 'react'
import Image from 'next/image'
import { getWateringCanImage } from '@/constants/plantTrees'
import type { WaterResult } from '@/hooks/usePlantPot'

type Props = {
  hearts: number
  disabled?: boolean
  onWater: () => Promise<WaterResult>
  onNoHearts: () => void
  onCompleted: () => void
  onLevelUp?: () => void
  /** 탭 직후 — 하트가 화분으로 날아가는 시각 효과용 */
  onPourVisual?: () => void
}

const WateringCanButton = forwardRef<HTMLButtonElement, Props>(function WateringCanButton(
  { hearts, disabled, onWater, onNoHearts, onCompleted, onLevelUp, onPourVisual },
  ref,
) {
  const [busy, setBusy] = useState(false)
  const canImg = getWateringCanImage(hearts)

  async function handleClick() {
    if (busy || disabled) return
    setBusy(true)
    onPourVisual?.()
    try {
      const result = await onWater()
      if (result === 'no_hearts') onNoHearts()
      else if (result === 'completed') onCompleted()
      else if (result === 'leveled_up') onLevelUp?.()
    } finally {
      window.setTimeout(() => setBusy(false), 420)
    }
  }

  return (
    // 누르는 동안: 아래쪽 축으로 살짝 왼쪽(화분 쪽) 기울임 + 약한 축소 — `active:` + `origin-bottom`
    <button
      ref={ref}
      type="button"
      onClick={() => void handleClick()}
      disabled={disabled || busy}
      className="relative flex shrink-0 origin-bottom items-center justify-center overflow-visible border-0 bg-transparent p-0 transition-transform duration-150 ease-out active:scale-[0.94] active:-rotate-[14deg] disabled:opacity-50"
      aria-label={`물 주기 — 보유 하트 ${hearts}개`}
    >
      <div className="relative shrink-0 overflow-visible" style={{ width: 32, height: 32 }}>
        <Image src={canImg} alt="물조리개" fill className="object-contain" sizes="32px" priority />
      </div>
    </button>
  )
})

WateringCanButton.displayName = 'WateringCanButton'

export default WateringCanButton
