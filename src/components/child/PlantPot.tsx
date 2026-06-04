'use client'

/**
 * 화분 UI — 캐릭터 옆 작은 성장 위젯입니다.
 *
 * 비개발자 설명:
 * - 바깥 화면에는 화분 그림만 보입니다. 탭하면 팝업이 열립니다.
 * - 팝업 가운데에 화분, 오른쪽에 물조리개가 있습니다.
 * - 물조리개: 물방울 연출과 함께 식물이 자랍니다(하트 1 소모).
 */

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import Image from 'next/image'
import { createPortal } from 'react-dom'
import {
  getStageImage,
  isPotAwaitingSeed,
  STAGE_LABELS,
  type PlantStage,
} from '@/constants/plantTrees'
import type { PlantHarvestCelebrate } from '@/lib/plantHarvest'
import type { PotState, WaterResult } from '@/hooks/usePlantPot'
import WateringCanButton from '@/components/child/WateringCanButton'
import SpriteImage from '@/components/common/SpriteImage'
import { ICONS } from '@/constants/sprites'

/** 도구 탭 효과음 */
const PLANT_TOOL_CLICK_SOUND_SRC = '/assets/audio/effects/star-pop-click-2364.wav' as const

export type PlantPotWaterActions = {
  hearts: number
  water: () => Promise<WaterResult>
  onNoHearts: () => void
  onGrowthCelebrate?: (newStage: PlantStage, harvest?: PlantHarvestCelebrate) => void
  /**
   * 7단계(완성)에서는 하트가 0이어도 서버가 화분만 씨앗으로 돌립니다 — 물조리개 잠금을 풉니다.
   */
  allowWaterWithoutHearts?: boolean
}

type Props = {
  pot: PotState
  onRequestSeedSelect?: () => void
  /** 있으면 팝업 안에서 물조리개로 물을 줍니다. */
  waterActions?: PlantPotWaterActions
}

/** 별 파티클 — 메인 화면 화분 버튼 레벨업 연출용 */
function StarParticle({ index }: { index: number }) {
  const angle = (index / 8) * 2 * Math.PI
  const distance = 28 + (index % 4) * 6
  const size = 8 + (index % 3) * 4
  const dx = Math.cos(angle) * distance
  const dy = Math.sin(angle) * distance
  const emoji = ['✨', '⭐', '💫', '🌟'][index % 4]
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2"
      style={
        {
          width: size,
          height: size,
          marginTop: -size / 2,
          marginLeft: -size / 2,
          fontSize: size,
          lineHeight: 1,
          animation: 'starFly 0.7s ease-out forwards',
          animationDelay: `${index * 0.04}s`,
          ['--tx' as string]: `${dx.toFixed(1)}px`,
          ['--ty' as string]: `${dy.toFixed(1)}px`,
        } as CSSProperties
      }
    >
      {emoji}
    </div>
  )
}

/** 물조리개 탭 시 화분 위로 떨어지는 물방울 */
function WaterDrop({ index }: { index: number }) {
  const offsetX = (index - 1) * 10
  return (
    <span
      className="pointer-events-none absolute left-1/2 top-0 text-sky-400"
      style={{
        marginLeft: offsetX,
        fontSize: 14,
        lineHeight: 1,
        animation: 'plantWaterDrop 620ms ease-in forwards',
        animationDelay: `${index * 90}ms`,
      }}
      aria-hidden
    >
      💧
    </span>
  )
}

export default function PlantPot({ pot, onRequestSeedSelect, waterActions }: Props) {
  const prevStage = useRef(pot.stage)
  const skipInitialFx = useRef(true)
  const [levelUpBurst, setLevelUpBurst] = useState(false)
  const [showStars, setShowStars] = useState(false)
  const [statusPopupOpen, setStatusPopupOpen] = useState(false)
  const [inspectWiggle, setInspectWiggle] = useState(false)
  const [portalReady, setPortalReady] = useState(false)
  /** 물조리개 탭 시 화분 위 물방울 연출 */
  const [waterPourBurst, setWaterPourBurst] = useState(false)
  const arcWrapRef = useRef<HTMLDivElement>(null)
  const canVisualRef = useRef<HTMLDivElement>(null)
  const potVisualRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    if (skipInitialFx.current) {
      skipInitialFx.current = false
      prevStage.current = pot.stage
      return
    }
    if (pot.stage > prevStage.current) {
      setLevelUpBurst(true)
      setShowStars(true)
      const t1 = window.setTimeout(() => setLevelUpBurst(false), 900)
      const t2 = window.setTimeout(() => setShowStars(false), 1000)
      prevStage.current = pot.stage
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }
    prevStage.current = pot.stage
  }, [pot.stage])

  /** 미심기·완성 후 초기화 직후 — 사과 0단계(씨앗 심긴 화분) 미리보기 */
  const awaitingSeed = isPotAwaitingSeed(pot)
  const displayTreeId = awaitingSeed ? 'apple' : pot.treeId
  const displayStage = awaitingSeed ? 0 : pot.stage
  const imgSrc = getStageImage(displayTreeId, displayStage)
  const label = STAGE_LABELS[displayStage]
  /** 0단계(씨앗 심긴 화분) — 예전처럼 버튼·팝업 안에서 그림만 작게 표시 */
  const isCompactStageImage = displayStage === 0
  const popupPotImageClass = [
    'object-contain',
    isCompactStageImage ? 'scale-50 translate-y-2' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const homePotImageClass = [
    'object-contain',
    isCompactStageImage ? 'scale-50 translate-y-4' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const progressPct =
    pot.heartsNeeded > 0
      ? Math.max(0, Math.min(100, Math.round((pot.heartsUsed / pot.heartsNeeded) * 100)))
      : pot.stage >= 7
        ? 100
        : 0

  function playToolClickSound() {
    try {
      const audio = new Audio(PLANT_TOOL_CLICK_SOUND_SRC)
      audio.volume = 0.88
      void audio.play().catch(() => {
        /* noop */
      })
    } catch {
      /* noop */
    }
  }

  function handleInspectPot() {
    setInspectWiggle(true)
    setStatusPopupOpen(true)
    window.setTimeout(() => setInspectWiggle(false), 420)
  }

  /** 물조리개 — 물방울 연출 + 성장 API */
  async function handleWaterInPopup(): Promise<WaterResult> {
    playToolClickSound()
    setWaterPourBurst(true)
    window.setTimeout(() => setWaterPourBurst(false), 720)
    if (!waterActions) return 'ok'
    return waterActions.water()
  }

  const statusPopup = statusPopupOpen ? (
    <div className="fixed inset-0 z-[170] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="화분 상태">
      <button
        type="button"
        className="absolute inset-0 bg-black/35"
        aria-label="화분 상태 닫기"
        onClick={() => setStatusPopupOpen(false)}
      />
      <div className="relative z-[1] flex min-h-[20rem] w-full max-w-[18rem] flex-col rounded-2xl border border-green-100 bg-white p-4 shadow-xl">
        <h2 className="mt-4 text-center text-lg font-black leading-tight text-green-800">
          {label}
          <span className="block text-sm font-bold text-green-700/90">{pot.stage + 1}단계</span>
        </h2>

        {waterActions ? (
          <div className="mt-5 flex flex-1 flex-col items-center justify-center gap-2">
            <div ref={arcWrapRef} className="relative mx-auto h-28 w-full">
              {/* 화분 — 팝업 가로 중앙 */}
              <div ref={potVisualRef} className="absolute left-1/2 top-0 h-28 w-28 -translate-x-1/2">
                <Image
                  src={imgSrc}
                  alt={label}
                  fill
                  className={popupPotImageClass}
                  sizes="112px"
                />
                {waterPourBurst ? (
                  <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
                    {[0, 1, 2].map((i) => (
                      <WaterDrop key={i} index={i} />
                    ))}
                  </div>
                ) : null}
              </div>

              {/* 물조리개 — 화분 오른쪽 */}
              <div
                ref={canVisualRef}
                className="absolute bottom-0 left-1/2 origin-bottom translate-x-[3.5rem] translate-y-1 scale-[1.55]"
              >
                <WateringCanButton
                  hearts={waterActions.hearts}
                  disabled={false}
                  allowWaterWithoutHearts={waterActions.allowWaterWithoutHearts}
                  onWater={handleWaterInPopup}
                  onNoHearts={waterActions.onNoHearts}
                  onGrowthCelebrate={waterActions.onGrowthCelebrate}
                />
              </div>
            </div>

            <div className="mx-auto mt-2 w-[82%] px-1">
              <div className="relative h-2.5 w-full overflow-visible rounded-full bg-gray-300">
                <div
                  className="h-full rounded-full bg-pink-300 transition-all duration-500 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
                <span
                  className="pointer-events-none absolute top-1/2 -translate-y-1/2"
                  style={{ left: `calc(${progressPct}% - 8px)` }}
                >
                  <SpriteImage
                    sheet={ICONS}
                    frame="heart"
                    width={20}
                    clipRotated={false}
                    className="h-5 w-5 object-contain drop-shadow-sm"
                  />
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto mt-4 flex h-32 w-32 items-center justify-center">
            <div className="relative h-28 w-28">
              <Image
                src={imgSrc}
                alt={label}
                fill
                className={popupPotImageClass}
                sizes="112px"
              />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setStatusPopupOpen(false)}
          className="mt-auto mb-2 w-full rounded-xl bg-gray-100 py-2.5 text-sm font-bold text-gray-700"
        >
          닫기
        </button>
      </div>
      <style>{`
        @keyframes plantWaterDrop {
          0% {
            transform: translateY(0) scale(0.7);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          100% {
            transform: translateY(52px) scale(1);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  ) : null

  return (
    <>
      <style>{`
        @keyframes starFly {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(var(--tx, 0px), var(--ty, 0px)) scale(0);
            opacity: 0;
          }
        }
        @keyframes glowRing {
          0% {
            box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.9);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 0 14px rgba(255, 215, 0, 0.4);
            transform: scale(1.15);
          }
          100% {
            box-shadow: 0 0 0 24px rgba(255, 215, 0, 0);
            transform: scale(1);
          }
        }
        @keyframes flashWhite {
          0% {
            filter: brightness(1);
          }
          30% {
            filter: brightness(3) saturate(0);
          }
          100% {
            filter: brightness(1);
          }
        }
        @keyframes potWiggle {
          0%   { transform: rotate(0deg) scale(1); }
          20%  { transform: rotate(-4deg) scale(1.02); }
          40%  { transform: rotate(4deg) scale(1.02); }
          60%  { transform: rotate(-3deg) scale(1.01); }
          80%  { transform: rotate(3deg) scale(1.01); }
          100% { transform: rotate(0deg) scale(1); }
        }
      `}</style>

      <div className="flex select-none flex-col items-center gap-0.5">
        <button
          type="button"
          onClick={handleInspectPot}
          className="relative transition-all duration-500"
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            animation: [
              levelUpBurst ? 'glowRing 0.9s ease-out, flashWhite 0.4s ease-out' : '',
              inspectWiggle ? 'potWiggle 0.42s ease-in-out' : '',
            ]
              .filter(Boolean)
              .join(', ') || undefined,
          }}
          aria-label={`화분: ${label} (탭해서 관리하기)`}
        >
          {showStars ? Array.from({ length: 8 }, (_, i) => <StarParticle key={i} index={i} />) : null}

          <Image
            src={imgSrc}
            alt={label}
            fill
            className={homePotImageClass}
            sizes="56px"
            priority
          />
        </button>

        {pot.completed && pot.stage === 7 && typeof onRequestSeedSelect === 'function' ? (
          <button
            type="button"
            onClick={onRequestSeedSelect}
            className="pointer-events-auto mt-0.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[8px] font-black text-pink-600 shadow-sm transition active:scale-95"
          >
            씨앗 고르기
          </button>
        ) : null}
      </div>

      {portalReady && statusPopup ? createPortal(statusPopup, document.body) : null}
    </>
  )
}
