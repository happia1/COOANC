'use client'

/**
 * 화분 UI — 캐릭터 옆에 두는 작은 성장 위젯입니다.
 *
 * 비개발자 설명:
 * - 단계별 그림은 `STAGE_IMAGE` PNG 로 표시합니다.
 * - 단계가 오르면 별 터지기 + 금색 링·번쩍임으로 「레벨업」을 알려요.
 * - 완성이 되면 「씨앗 고르기」로 다음 식물을 시작할 수 있어요.
 * - 하트 진행 바는 쓰지 않습니다(진행은 그림 단계로만 표현).
 */

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import Image from 'next/image'
import SpriteImage from '@/components/common/SpriteImage'
import { ICONS } from '@/constants/sprites'
import { createPortal } from 'react-dom'
import { STAGE_IMAGE, STAGE_LABELS } from '@/constants/plantTrees'
import type { PotState } from '@/hooks/usePlantPot'

type Props = {
  pot: PotState
  onRequestSeedSelect?: () => void
}

/** 별 파티클 1개 — 방향·거리는 JS 로 계산해 CSS 변수로 넘깁니다(브라우저마다 다른 삼각함수 CSS 지원을 피함). */
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
          // @keyframes starFly 가 translate(var(--tx), var(--ty)) 에 사용
          ['--tx' as string]: `${dx.toFixed(1)}px`,
          ['--ty' as string]: `${dy.toFixed(1)}px`,
        } as CSSProperties
      }
    >
      {emoji}
    </div>
  )
}

export default function PlantPot({ pot, onRequestSeedSelect }: Props) {
  const prevStage = useRef(pot.stage)
  const skipInitialFx = useRef(true)
  const [levelUpBurst, setLevelUpBurst] = useState(false)
  const [showStars, setShowStars] = useState(false)
  /** 화분 상태 확인 팝업 열림 여부 */
  const [statusPopupOpen, setStatusPopupOpen] = useState(false)
  /** 화분 클릭 시 짧게 꿈틀거리는 모션 */
  const [inspectWiggle, setInspectWiggle] = useState(false)
  /** 포털 렌더 준비(클라이언트에서만 true) */
  const [portalReady, setPortalReady] = useState(false)

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    /** 첫 동기화 직후에는 불꽃 효과를 켜지 않음(이미 진행 중인 단계로 들어온 경우). */
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
  /** 단계 진행도(하트) — 완성 단계는 100%로 간주 */
  const progressPct =
    pot.heartsNeeded > 0
      ? Math.max(0, Math.min(100, Math.round((pot.heartsUsed / pot.heartsNeeded) * 100)))
      : 100
  /** 10칸 하트 진행(0~10) */
  const filledHearts = Math.max(0, Math.min(10, Math.round(progressPct / 10)))
  const totalHeartSlots = 10

  function handleInspectPot() {
    setInspectWiggle(true)
    setStatusPopupOpen(true)
    window.setTimeout(() => setInspectWiggle(false), 420)
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
        <div className="mx-auto h-[158px] w-[158px]">
          <div className="relative h-full w-full">
            {Array.from({ length: totalHeartSlots }, (_, i) => {
              /**
               * 12시 방향부터 시계방향으로 하트를 배치합니다.
               * - i=0 이 맨 위, i 증가에 따라 오른쪽→아래→왼쪽 순으로 돕니다.
               */
              const angle = -Math.PI / 2 + (2 * Math.PI * i) / totalHeartSlots
              const radius = 64
              const cx = 79
              const cy = 79
              const x = cx + Math.cos(angle) * radius
              const y = cy + Math.sin(angle) * radius
              const isFilled = i < filledHearts
              return (
                <span
                  key={i}
                  className="absolute inline-flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                  style={{ left: `${x}px`, top: `${y}px` }}
                >
                  <SpriteImage
                    sheet={ICONS}
                    frame="heart"
                    width={14}
                    clipRotated={false}
                    className={[
                      'h-3.5 w-3.5 object-contain',
                      isFilled ? '' : 'grayscale brightness-75 opacity-60',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  />
                </span>
              )
            })}
            <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2">
              <Image
                src={imgSrc}
                alt={label}
                fill
                className={['object-contain', isSeedStage ? 'scale-50 translate-y-2' : ''].filter(Boolean).join(' ')}
                sizes="80px"
              />
            </div>
          </div>
        </div>

        <div className="mt-2 text-center">
          <p className="text-lg font-black text-green-700">{label}</p>
          <p className="mt-0.5 text-sm font-black text-gray-800">
            현재 단계: <span className="text-green-700">{pot.stage + 1}단계</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => setStatusPopupOpen(false)}
          className="mt-4 w-full rounded-xl bg-gray-100 py-2.5 text-sm font-bold text-gray-700"
        >
          닫기
        </button>
      </div>
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
          aria-label={`화분: ${label} (탭해서 상태 보기)`}
        >
          {showStars
            ? Array.from({ length: 8 }, (_, i) => <StarParticle key={i} index={i} />)
            : null}

          <Image
            src={imgSrc}
            alt={label}
            fill
            // 비개발자: 씨앗(0단계) 그림만 작게(50%) + 아래로 살짝 내려서 위치를 맞춥니다.
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
