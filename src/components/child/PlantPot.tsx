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
      `}</style>

      <div className="flex select-none flex-col items-center gap-0.5">
        <div
          className="relative transition-all duration-500"
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            animation: levelUpBurst
              ? 'glowRing 0.9s ease-out, flashWhite 0.4s ease-out'
              : undefined,
          }}
          aria-label={`화분: ${label}`}
        >
          {showStars
            ? Array.from({ length: 8 }, (_, i) => <StarParticle key={i} index={i} />)
            : null}

          <Image src={imgSrc} alt={label} fill className="object-contain" sizes="56px" priority />
        </div>

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
    </>
  )
}
