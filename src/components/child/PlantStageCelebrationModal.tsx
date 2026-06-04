'use client'

/**
 * 화분이 한 단계 올라갈 때마다 뜨는 축하 팝업.
 * 7단계(완성)에서는 수확 축하 문구를 함께 표시합니다.
 */

import Image from 'next/image'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  getPlantStageCelebrationTitle,
  getRewardImage,
  getStageImage,
  type PlantStage,
  type PlantTreeId,
} from '@/constants/plantTrees'
import type { PlantHarvestCelebrate } from '@/lib/plantHarvest'

type Props = {
  open: boolean
  stage: PlantStage | null
  treeId?: PlantTreeId
  /** 7단계 완성 수확 정보 */
  harvest?: PlantHarvestCelebrate | null
  onClose: () => void
}

function fireCelebrateConfetti() {
  void import('canvas-confetti').then((mod) => {
    const confetti = mod.default
    confetti({
      particleCount: 110,
      spread: 82,
      startVelocity: 38,
      origin: { x: 0.5, y: 0.52 },
      zIndex: 300,
    })
    window.setTimeout(() => {
      confetti({ particleCount: 72, spread: 95, startVelocity: 26, origin: { x: 0.34, y: 0.46 }, zIndex: 300 })
    }, 160)
    window.setTimeout(() => {
      confetti({ particleCount: 72, spread: 95, startVelocity: 26, origin: { x: 0.66, y: 0.46 }, zIndex: 300 })
    }, 300)
    window.setTimeout(() => {
      confetti({
        particleCount: 56,
        spread: 360,
        startVelocity: 22,
        ticks: 160,
        origin: { x: 0.5, y: 0.58 },
        zIndex: 300,
      })
    }, 420)
  })
}

export default function PlantStageCelebrationModal({
  open,
  stage,
  treeId = 'apple',
  harvest,
  onClose,
}: Props) {
  const confettiFired = useRef(false)
  const isFinalHarvest = open && stage === 7 && harvest != null

  useEffect(() => {
    if (!open || stage === null || stage < 1) {
      confettiFired.current = false
      return
    }
    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (!reduceMotion && !confettiFired.current) {
      confettiFired.current = true
      fireCelebrateConfetti()
    }
  }, [open, stage])

  if (!open || stage === null || stage < 1 || typeof window === 'undefined') return null

  const title = isFinalHarvest ? '축하해요!' : getPlantStageCelebrationTitle(stage)
  const subtitle = isFinalHarvest
    ? `${harvest.fruitName}를 ${harvest.amount}개 수확했어요!`
    : null
  const imgSrc = isFinalHarvest ? getRewardImage(treeId) : getStageImage(treeId, stage)
  const ctaLabel = isFinalHarvest ? '확인' : '물 주러가기'
  const harvestHint = isFinalHarvest ? '화분을 눌러 어떤 씨앗을 골라볼까요?' : null

  const modal = (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plant-celebrate-title"
      aria-describedby="plant-celebrate-desc"
    >
      <button type="button" className="absolute inset-0 bg-black/55" aria-label="닫기" onClick={onClose} />
      <div className="relative z-10 mx-4 flex w-full max-w-sm flex-col items-center rounded-[1.75rem] bg-white px-6 pb-6 pt-7 shadow-2xl">
        <p id="plant-celebrate-desc" className="sr-only">
          {isFinalHarvest ? '수확 축하' : '성장 단계 안내'}
        </p>
        <div className="relative mb-5 h-[151px] w-[151px] shrink-0">
          <Image src={imgSrc} alt="" fill className="object-contain drop-shadow-md" sizes="151px" priority />
        </div>
        <h2 id="plant-celebrate-title" className="mb-2 text-center text-xl font-black leading-snug text-gray-900 sm:text-2xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="mb-2 text-center text-base font-bold leading-snug text-amber-800">{subtitle}</p>
        ) : null}
        {harvestHint ? (
          <p className="mb-4 text-center text-sm font-semibold leading-snug text-gray-600">{harvestHint}</p>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-2xl bg-[#63C964] py-3.5 text-base font-black text-white shadow-md transition-opacity active:opacity-85 sm:py-4"
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
