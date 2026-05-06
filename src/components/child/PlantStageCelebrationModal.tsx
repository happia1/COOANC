'use client'

/**
 * 화분이 한 단계 올라갈 때마다 뜨는 축하 팝업.
 * - 해당 단계 `STAGE_IMAGE` 일러스트 + 짧은 축하 문구
 * - 화면과 함께 canvas-confetti 로 콘페티(움직임 줄이기 설정 시에는 생략)
 */

import Image from 'next/image'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { getPlantStageCelebrationTitle, STAGE_IMAGE, type PlantStage } from '@/constants/plantTrees'

type Props = {
  open: boolean
  /** 방금 물 준 뒤 도달한 단계(1~7) — 0이면 렌더하지 않음 */
  stage: PlantStage | null
  onClose: () => void
}

function fireCelebrateConfetti() {
  void import('canvas-confetti').then((mod) => {
    const confetti = mod.default
    /** 화분이 있는 화면 중앙 부근에서 퍼지도록 origin 을 약간 아래로 */
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

export default function PlantStageCelebrationModal({ open, stage, onClose }: Props) {
  const confettiFired = useRef(false)

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

  const title = getPlantStageCelebrationTitle(stage)
  const imgSrc = STAGE_IMAGE[stage]

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
          성장 단계 안내 및 축하
        </p>
        {/* 단계별 화분 일러스트 — 기존 116px 대비 1.3배(약 151px), 정수 픽셀로 선명도 유지 */}
        <div className="relative mb-5 h-[151px] w-[151px] shrink-0">
          <Image src={imgSrc} alt="" fill className="object-contain drop-shadow-md" sizes="151px" priority />
        </div>
        <h2 id="plant-celebrate-title" className="mb-2 text-center text-xl font-black leading-snug text-gray-900 sm:text-2xl">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-2xl bg-[#63C964] py-3.5 text-base font-black text-white shadow-md transition-opacity active:opacity-85 sm:py-4"
        >
          물 주러가기
        </button>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
