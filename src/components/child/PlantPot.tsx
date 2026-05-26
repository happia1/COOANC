'use client'

/**
 * 화분 UI — 캐릭터 옆 작은 성장 위젯입니다.
 *
 * 비개발자 설명:
 * - 바깥 화면에는 화분 그림만 보입니다. 물조리개는 **화분을 눌렀을 때 나오는 팝업 안**에 있습니다.
 * - 팝업 상단에는 지금 식물 단계 이름이 제목으로 나옵니다.
 * - 물조리개를 누르면 물방울이 아래로 떨어지는 효과만 보이고, 예전처럼 하트가 날아가지는 않습니다.
 * - 화분 아래 막대는 「다음 단계까지」 하트 진행률을 보여 줍니다.
 */

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import Image from 'next/image'
import { createPortal } from 'react-dom'
import { STAGE_IMAGE, STAGE_LABELS, type PlantStage } from '@/constants/plantTrees'
import type { PotState, WaterResult } from '@/hooks/usePlantPot'
import WateringCanButton from '@/components/child/WateringCanButton'
import SpriteImage from '@/components/common/SpriteImage'
import { ICONS } from '@/constants/sprites'

/** 물조리개 버튼 탭(클릭) 효과음 */
const PLANT_CAN_CLICK_SOUND_SRC = '/assets/audio/effects/star-pop-click-2364.wav' as const

export type PlantPotWaterActions = {
  hearts: number
  water: () => Promise<WaterResult>
  onNoHearts: () => void
  onGrowthCelebrate?: (newStage: PlantStage) => void
  /**
   * 7단계(완성)에서는 하트가 0이어도 서버가 화분만 씨앗으로 돌립니다 — 버튼 잠금을 풉니다.
   * 비개발자: 열매가 다 익은 뒤에는 하트가 없어도 물조리개를 누를 수 있어요.
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

export default function PlantPot({ pot, onRequestSeedSelect, waterActions }: Props) {
  const prevStage = useRef(pot.stage)
  const skipInitialFx = useRef(true)
  const [levelUpBurst, setLevelUpBurst] = useState(false)
  const [showStars, setShowStars] = useState(false)
  const [statusPopupOpen, setStatusPopupOpen] = useState(false)
  const [inspectWiggle, setInspectWiggle] = useState(false)
  const [portalReady, setPortalReady] = useState(false)
  /** 물줄 때 팝업 안 하트 포물선 연출 데이터(시작점/도착점) */
  const [heartBurst, setHeartBurst] = useState<{
    id: number
    startX: number
    startY: number
    dx: number
    dy: number
    arc: number
  } | null>(null)
  /** 물조리개 클릭 시 팝업 안에서 추가 흔들림(좌우) 연출 */
  const [canShakeBurst, setCanShakeBurst] = useState(false)
  /** 포물선 좌표 계산용: 같은 팝업 내부 기준 좌표 */
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

  const imgSrc = STAGE_IMAGE[pot.stage]
  const label = STAGE_LABELS[pot.stage]
  const isSeedStage = pot.stage === 0
  const progressPct =
    pot.heartsNeeded > 0
      ? Math.max(0, Math.min(100, Math.round((pot.heartsUsed / pot.heartsNeeded) * 100)))
      : pot.stage >= 7
        ? 100
        : 0

  function playCanClickSound() {
    try {
      const audio = new Audio(PLANT_CAN_CLICK_SOUND_SRC)
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

  /** 팝업 안 물주기 — 성공 시 하트 포물선 연출을 재생합니다. */
  async function handleWaterInPopup(): Promise<WaterResult> {
    // 요청사항: 물조리개를 누르는 즉시 클릭 사운드 재생
    playCanClickSound()
    setCanShakeBurst(true)
    window.setTimeout(() => setCanShakeBurst(false), 340)
    if (!waterActions) return 'ok'
    const r = await waterActions.water()
    if (r !== 'no_hearts') {
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
        const id = Date.now()
        setHeartBurst({ id, startX, startY, dx, dy, arc })
        window.setTimeout(() => {
          setHeartBurst((prev) => (prev && prev.id === id ? null : prev))
        }, 700)
      }
    }
    return r
  }

  const statusPopup = statusPopupOpen ? (
    <div className="fixed inset-0 z-[170] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="화분 상태">
      <button
        type="button"
        className="absolute inset-0 bg-black/35"
        aria-label="화분 상태 닫기"
        onClick={() => setStatusPopupOpen(false)}
      />
      <div className="relative z-[1] w-full max-w-xs rounded-2xl border border-green-100 bg-white p-4 shadow-xl">
        <h2 className="text-center text-lg font-black leading-tight text-green-800">
          {label}
          <span className="block text-sm font-bold text-green-700/90">{pot.stage + 1}단계</span>
        </h2>

        {waterActions ? (
          <div className="mt-4 flex flex-col items-center gap-2.5">
            <div ref={arcWrapRef} className="relative mx-auto flex w-[220px] items-end justify-between px-1">
              {/* 위치 교체: 화분을 왼쪽으로 보냅니다. */}
              <div ref={potVisualRef} className="relative h-24 w-24">
                <Image
                  src={imgSrc}
                  alt={label}
                  fill
                  className={['object-contain', isSeedStage ? 'scale-50 translate-y-2' : ''].filter(Boolean).join(' ')}
                  sizes="96px"
                />
              </div>

              {/* 위치 교체: 물조리개를 오른쪽에 두고, 살짝 중앙(왼쪽)으로 당깁니다. */}
              <div
                ref={canVisualRef}
                className="origin-bottom-right scale-[2] -translate-x-3"
                style={{ animation: canShakeBurst ? 'popupCanShake 0.34s ease-in-out' : undefined }}
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

              {/* 물주기 성공 시 하트가 화분으로 포물선을 그리며 날아갑니다. */}
              {heartBurst ? (
                <span
                  key={heartBurst.id}
                  className="pointer-events-none absolute left-0 top-0"
                  style={{
                    left: `${heartBurst.startX}px`,
                    top: `${heartBurst.startY}px`,
                    animation: 'plantPotHeartArc 620ms ease-out forwards',
                    ['--dx' as string]: `${heartBurst.dx}px`,
                    ['--dy' as string]: `${heartBurst.dy}px`,
                    ['--arc' as string]: `${heartBurst.arc}px`,
                  }}
                >
                  <SpriteImage
                    sheet={ICONS}
                    frame="heart"
                    width={18}
                    clipRotated={false}
                    className="h-[18px] w-[18px] object-contain"
                  />
                </span>
              ) : null}
            </div>

            <div className="mx-auto w-[92%] px-1">
              <div className="relative h-2.5 w-full overflow-visible rounded-full bg-pink-100">
                <div
                  className="h-full rounded-full bg-pink-200 transition-all duration-500 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
                {/* 게이지 끝 하트 — 진행률에 따라 막대 끝을 따라 이동합니다. */}
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
                className={['object-contain', isSeedStage ? 'scale-50 translate-y-2' : ''].filter(Boolean).join(' ')}
                sizes="112px"
              />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setStatusPopupOpen(false)}
          className="mt-5 w-full rounded-xl bg-gray-100 py-2.5 text-sm font-bold text-gray-700"
        >
          닫기
        </button>
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
        @keyframes popupCanShake {
          0%   { transform: translateX(-4px) rotate(0deg) scale(2); }
          20%  { transform: translateX(-4px) rotate(-8deg) scale(2); }
          45%  { transform: translateX(-4px) rotate(7deg) scale(2); }
          70%  { transform: translateX(-4px) rotate(-6deg) scale(2); }
          100% { transform: translateX(-4px) rotate(0deg) scale(2); }
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
          aria-label={`화분: ${label} (탭해서 물주기)`}
        >
          {showStars ? Array.from({ length: 8 }, (_, i) => <StarParticle key={i} index={i} />) : null}

          <Image
            src={imgSrc}
            alt={label}
            fill
            className={['object-contain', isSeedStage ? 'scale-50 translate-y-4' : ''].filter(Boolean).join(' ')}
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
