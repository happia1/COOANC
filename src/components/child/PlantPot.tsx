'use client'

/**
 * 화분 UI — 캐릭터 옆 작은 성장 위젯입니다.
 *
 * 비개발자 설명:
 * - 바깥 화면에는 화분 그림만 보입니다. 탭하면 팝업이 열립니다.
 * - 팝업 가운데에 화분, 오른쪽에 물조리개가 있습니다.
 * - 물조리개: 하트가 화분으로 포물선을 그리며 날아가는 연출과 함께 식물이 자랍니다(하트 1 소모).
 */

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import Image from 'next/image'
import { createPortal } from 'react-dom'
import {
  getDisplayStepIndex,
  getPlantTree,
  getStageImage,
  isPotAwaitingFirstSeed,
  needsPotSeedSelection,
  PLANT_UNSELECTED_SHOVEL_SRC,
  STAGE_LABELS,
  type PlantStage,
  type PlantTreeId,
} from '@/constants/plantTrees'
import {
  getPlantPotVisualStyle,
  getPlantShovelHomeVisualStyle,
  type PlantPotVisualStyle,
} from '@/constants/plantPotVisual'
import type { PlantHarvestCelebrate } from '@/lib/plantHarvest'
import type { BuySeedResult, PotState, WaterResult } from '@/hooks/usePlantPot'
import SeedSelectPicker from '@/components/child/SeedSelectPicker'
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
  /** 단계 상승 축하 팝업이 떠 있는 동안 true — 물조리개가 튕기는 연출만 보여주고 물주기를 막습니다 */
  locked?: boolean
}

export type PlantPotSeedSelect = {
  currentCredits: number
  onSelect: (treeId: PlantTreeId) => Promise<BuySeedResult>
  onPlanted?: () => void
}

type Props = {
  pot: PotState
  /** 씨앗 고르기·미심기·수확 직후 — 화분 팝업 안에 씨앗 카드를 띄웁니다. */
  seedSelect?: PlantPotSeedSelect
  /** 있으면 팝업 안에서 물조리개로 물을 줍니다. */
  waterActions?: PlantPotWaterActions
  /**
   * 수확/성장 축하 팝업이 떠 있는 동안 true.
   * 수확(7단계 완성) 순간 화분 상태 팝업이 씨앗 픽커로 바뀌어 축하보다 먼저 뜨는 것을 막고,
   * 축하 팝업을 먼저 보여 준 뒤(확인) 홈의 모종삽을 눌렀을 때만 씨앗 픽커가 열리게 합니다.
   */
  celebrationActive?: boolean
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

/** 성장 단계 PNG — 로드 실패 시 이모지로 대체(깨진 이미지 방지) */
function PlantTreeStageImage({
  treeId,
  stage,
  className,
  sizes,
  priority,
  visualStyle,
}: {
  treeId: PlantTreeId
  stage: PlantStage
  className: string
  sizes: string
  priority?: boolean
  visualStyle?: ReturnType<typeof getPlantPotVisualStyle>
}) {
  const [failed, setFailed] = useState(false)
  const emoji = getPlantTree(treeId).emoji

  if (failed) {
    return (
      <span
        className={`absolute inset-0 flex items-center justify-center leading-none ${className}`}
        style={{ fontSize: '2rem' }}
        aria-hidden
      >
        {emoji}
      </span>
    )
  }

  const inner = (
    <Image
      src={getStageImage(treeId, stage)}
      alt=""
      fill
      className={className}
      sizes={sizes}
      priority={priority}
      unoptimized
      onError={() => setFailed(true)}
    />
  )

  if (!visualStyle) return inner

  return (
    <div
      className="absolute inset-0 flex items-end justify-center"
      style={{
        transform: `translate(${visualStyle.translateX}px, ${visualStyle.translateY}px) scale(${visualStyle.scale})`,
        transformOrigin: visualStyle.transformOrigin,
      }}
    >
      <div className="relative h-full w-full">{inner}</div>
    </div>
  )
}

/** 씨앗 미선택 — 모종삽 아이콘(탭하면 씨앗 카드) */
function PlantShovelImage({
  className,
  sizes,
  priority,
  visualStyle,
}: {
  className: string
  sizes: string
  priority?: boolean
  visualStyle: PlantPotVisualStyle
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span
        className={`absolute inset-0 flex items-center justify-center leading-none ${className}`}
        style={{ fontSize: '2rem' }}
        aria-hidden
      >
        🪴
      </span>
    )
  }

  const inner = (
    <Image
      src={PLANT_UNSELECTED_SHOVEL_SRC}
      alt=""
      fill
      className={className}
      sizes={sizes}
      priority={priority}
      unoptimized
      onError={() => setFailed(true)}
    />
  )

  return (
    <div
      className="absolute inset-0 flex items-end justify-center"
      style={{
        transform: `translate(${visualStyle.translateX}px, ${visualStyle.translateY}px) scale(${visualStyle.scale})`,
        transformOrigin: visualStyle.transformOrigin,
      }}
    >
      <div className="relative h-full w-full">{inner}</div>
    </div>
  )
}

/** 물주기 성공 시 화분으로 포물선을 그리며 날아가는 하트 1개의 궤적 데이터 */
type HeartBurst = {
  id: number
  startX: number
  startY: number
  dx: number
  dy: number
  arc: number
}

/** 물조리개 탭 시 화분으로 날아가는 하트 — 연속 탭이면 여러 개가 겹쳐 날아갑니다 */
function HeartFly({ burst }: { burst: HeartBurst }) {
  return (
    <span
      className="pointer-events-none absolute left-0 top-0"
      style={{
        left: burst.startX,
        top: burst.startY,
        animation: 'plantPotHeartArc 620ms ease-out forwards',
        ['--dx' as string]: `${burst.dx}px`,
        ['--dy' as string]: `${burst.dy}px`,
        ['--arc' as string]: `${burst.arc}px`,
      }}
      aria-hidden
    >
      <SpriteImage
        sheet={ICONS}
        frame="heart"
        width={18}
        clipRotated={false}
        className="h-[18px] w-[18px] object-contain"
      />
    </span>
  )
}

export default function PlantPot({ pot, seedSelect, waterActions, celebrationActive = false }: Props) {
  const prevStage = useRef(pot.stage)
  const skipInitialFx = useRef(true)
  const [levelUpBurst, setLevelUpBurst] = useState(false)
  const [showStars, setShowStars] = useState(false)
  const [statusPopupOpen, setStatusPopupOpen] = useState(false)
  /**
   * 팝업을 **열던 순간** 씨앗 선택이 필요했는지(=모종삽을 눌러 연 것인지)를 기억합니다.
   * 물주기로 팝업이 열려 있는 동안 수확이 일어나 씨앗 선택 상태가 되어도, 이 값이 false 면
   * 씨앗 픽커로 바뀌지 않습니다 → 축하 팝업이 먼저, 씨앗 픽커는 모종삽 재탭 시에만.
   */
  const [seedPickerArmed, setSeedPickerArmed] = useState(false)
  const [inspectWiggle, setInspectWiggle] = useState(false)
  const [portalReady, setPortalReady] = useState(false)
  /** 물조리개 탭 시 화분으로 날아가는 하트들 — 탭마다 하나씩 쌓였다 각자 사라집니다 */
  const [heartBursts, setHeartBursts] = useState<HeartBurst[]>([])
  const heartBurstIdRef = useRef(0)
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

  const needsSeedSelection = needsPotSeedSelection(pot)
  const awaitingFirstSeed = isPotAwaitingFirstSeed(pot)
  /** 수확 후 재심기 등 — 팝업 안 미리보기용(사과 0단계). 홈은 모종삽으로 표시합니다. */
  const useAppleSeedPreview = needsSeedSelection && !awaitingFirstSeed
  /**
   * 씨앗 픽커는 (모종삽을 눌러 연 팝업) + (씨앗 선택 필요) + (축하 안 뜬 상태)일 때만.
   * 물주기 중 수확이 일어나 morph 되는 경우(seedPickerArmed=false)는 배제됩니다.
   */
  const showSeedPickerInPopup =
    Boolean(seedSelect) && needsSeedSelection && seedPickerArmed && !celebrationActive

  /** 수확 축하가 뜨면 열려 있던 물주기 팝업을 닫아, 축하만 깔끔히 보이게 합니다. */
  useEffect(() => {
    if (celebrationActive && needsSeedSelection) {
      setStatusPopupOpen(false)
    }
  }, [celebrationActive, needsSeedSelection])
  const seedPickerIntro =
    pot.hasChosenSeed && pot.stage === 7 && pot.completed
      ? '수확을 모두 완료했어요! 새로운 씨앗을 심어볼까요?'
      : null
  const displayTreeId = useAppleSeedPreview ? 'apple' : pot.treeId
  const displayStage = useAppleSeedPreview ? 0 : pot.stage
  const label = STAGE_LABELS[displayStage]
  const shovelHomeVisual = getPlantShovelHomeVisualStyle()
  const homeVisual = getPlantPotVisualStyle(displayTreeId, displayStage, 'home', {
    matchStrawberryStage1Home: useAppleSeedPreview,
  })
  const popupVisual = getPlantPotVisualStyle(displayTreeId, displayStage, 'popup')
  const popupPotImageClass = 'object-contain'
  const homePotImageClass = 'object-contain'
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
    /** 여는 순간의 씨앗 선택 필요 여부를 고정 — 물주기 중 morph 로 씨앗 픽커가 뜨는 것을 막습니다 */
    setSeedPickerArmed(needsSeedSelection)
    setInspectWiggle(true)
    setStatusPopupOpen(true)
    window.setTimeout(() => setInspectWiggle(false), 420)
  }

  /**
   * 물조리개 — 탭 즉시 하트 1개가 화분으로 포물선을 그리며 날아가는 연출 + 성장 API.
   * 서버 응답을 기다리지 않고 탭마다 바로 쏘아 올려, 연속 탭에서도 하트가 하나씩 연달아 날아갑니다.
   */
  function handleWaterInPopup(): Promise<WaterResult> {
    playToolClickSound()

    const wrap = arcWrapRef.current
    const canEl = canVisualRef.current
    const potEl = potVisualRef.current
    if (wrap && canEl && potEl) {
      const ww = wrap.getBoundingClientRect()
      const cw = canEl.getBoundingClientRect()
      const pw = potEl.getBoundingClientRect()
      /** 물조리개 입구 쪽(좌측)에서 출발 */
      const startX = cw.left + cw.width * 0.28 - ww.left
      const startY = cw.top + cw.height * 0.54 - ww.top
      /** 화분 중앙으로 정확히 도착 */
      const targetX = pw.left + pw.width * 0.5 - ww.left
      const targetY = pw.top + pw.height * 0.5 - ww.top
      const dx = targetX - startX
      const dy = targetY - startY
      const arc = Math.max(18, Math.abs(dx) * 0.24)
      const id = ++heartBurstIdRef.current
      setHeartBursts((prev) => [...prev, { id, startX, startY, dx, dy, arc }])
      window.setTimeout(() => {
        setHeartBursts((prev) => prev.filter((b) => b.id !== id))
      }, 700)
    }

    if (!waterActions) return Promise.resolve('ok')
    return waterActions.water()
  }

  const statusPopup = statusPopupOpen ? (
    <div
      className="fixed inset-0 z-[170] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={showSeedPickerInPopup ? '씨앗 고르기' : '화분 상태'}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/35"
        aria-label="닫기"
        onClick={() => setStatusPopupOpen(false)}
      />
      <div
        className={`relative z-[1] flex w-full flex-col rounded-2xl border border-green-100 bg-white p-4 shadow-xl ${
          showSeedPickerInPopup ? 'max-w-sm' : 'min-h-[20rem] max-w-[18rem]'
        }`}
      >
        {showSeedPickerInPopup && seedSelect ? (
          <>
            <SeedSelectPicker
              currentCredits={seedSelect.currentCredits}
              onSelect={seedSelect.onSelect}
              intro={seedPickerIntro}
              onPlanted={() => {
                seedSelect.onPlanted?.()
                setStatusPopupOpen(false)
              }}
            />
            <button
              type="button"
              onClick={() => setStatusPopupOpen(false)}
              className="mt-2 flex h-11 w-full items-center justify-center rounded-2xl bg-gray-100 text-sm font-bold text-gray-600 transition active:scale-[0.98]"
            >
              나중에
            </button>
          </>
        ) : (
          <>
        <h2 className="mt-4 text-center text-lg font-black leading-tight text-green-800">
          {label}
          <span className="block text-sm font-bold text-green-700/90">
            {getDisplayStepIndex(displayTreeId, displayStage)}단계
          </span>
        </h2>

        {waterActions ? (
          <div className="mt-5 flex flex-1 flex-col items-center justify-center gap-2">
            <div ref={arcWrapRef} className="relative mx-auto h-28 w-full">
              {/* 화분 — 팝업 가로 중앙 */}
              <div ref={potVisualRef} className="relative left-1/2 top-0 h-28 w-28 -translate-x-1/2">
                <PlantTreeStageImage
                  treeId={displayTreeId}
                  stage={displayStage}
                  visualStyle={popupVisual}
                  className={popupPotImageClass}
                  sizes="112px"
                />
              </div>

              {/* 물조리개 — 화분 오른쪽 */}
              <div
                ref={canVisualRef}
                className="absolute bottom-0 left-1/2 origin-bottom translate-x-[3.5rem] translate-y-1 scale-[1.55]"
              >
                <WateringCanButton
                  hearts={waterActions.hearts}
                  disabled={false}
                  locked={waterActions.locked}
                  allowWaterWithoutHearts={waterActions.allowWaterWithoutHearts}
                  onWater={handleWaterInPopup}
                  onNoHearts={waterActions.onNoHearts}
                  onGrowthCelebrate={waterActions.onGrowthCelebrate}
                />
              </div>

              {/* 물주기 성공 시 하트가 화분으로 포물선을 그리며 날아갑니다(연속 탭이면 여러 개 동시 표시) */}
              {heartBursts.map((burst) => (
                <HeartFly key={burst.id} burst={burst} />
              ))}
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
              <PlantTreeStageImage
                treeId={displayTreeId}
                stage={displayStage}
                visualStyle={popupVisual}
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
          </>
        )}
      </div>
      <style>{`
        @keyframes plantPotHeartArc {
          0% {
            transform: translate(0, 0) scale(0.95);
            opacity: 1;
          }
          55% {
            transform: translate(
              calc(var(--dx, 0px) * 0.55),
              calc(var(--dy, 0px) * 0.55 - var(--arc, 24px))
            ) scale(1.08);
            opacity: 1;
          }
          100% {
            transform: translate(var(--dx, 0px), var(--dy, 0px)) scale(0.8);
            opacity: 0.08;
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
          aria-label={
            awaitingFirstSeed
              ? '씨앗 심기: 탭해서 씨앗을 골라 주세요'
              : needsSeedSelection
                ? '화분: 씨앗을 골라 주세요'
                : `화분: ${label} (탭해서 관리하기)`
          }
        >
          {showStars ? Array.from({ length: 8 }, (_, i) => <StarParticle key={i} index={i} />) : null}

          <div className="relative h-full w-full overflow-visible">
            {needsSeedSelection ? (
              /**
               * 씨앗을 골라야 하는 상태(첫 씨앗 or 수확 후 재심기)에는 홈에 **모종삽**을 표시합니다.
               * 탭하면 씨앗 고르기 팝업이 열립니다. (수확 후 사과 미리보기 대신 모종삽으로 통일)
               */
              <PlantShovelImage
                visualStyle={shovelHomeVisual}
                className={homePotImageClass}
                sizes="56px"
                priority
              />
            ) : (
              <PlantTreeStageImage
                treeId={displayTreeId}
                stage={displayStage}
                visualStyle={homeVisual}
                className={homePotImageClass}
                sizes="56px"
                priority
              />
            )}
          </div>
        </button>

      </div>

      {portalReady && statusPopup ? createPortal(statusPopup, document.body) : null}
    </>
  )
}
