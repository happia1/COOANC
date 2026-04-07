'use client'

import { useEffect } from 'react'
import SpriteImage from '@/components/common/SpriteImage'
import { EFFECT_LIGHTS, EFFECT_TWINKLE, ICONS } from '@/constants/sprites'

type Props = {
  /** 부모가 바꿀 때마다 애니메이션 처음부터 다시 */
  playId: number
  /** 연출 종료 후 호출 — 오버레이 언마운트용 */
  onFinish: () => void
}

/** 트윙클 한 겹 — 코인 더미 주변을 도는 반짝임(`globals.css` 궤도 애니메이션) */
const TWINKLE_SPECS = [
  { cls: 'mission-credit-twinkle-a', width: 21 },
  { cls: 'mission-credit-twinkle-b', width: 20 },
  { cls: 'mission-credit-twinkle-c', width: 18 },
  { cls: 'mission-credit-twinkle-d', width: 23 },
  { cls: 'mission-credit-twinkle-e', width: 17 },
  { cls: 'mission-credit-twinkle-f', width: 20 },
] as const

/**
 * 미션 카드 탭 완료 시 풍경 위에 잠깐 보이는 연출입니다.
 * - 동전 더미가 위에서 아래로 슬라이딩하며 섬 방향으로 내려옵니다.
 * - 내려오는 동안 라이트/트윙클 반짝임을 같이 붙여, "보상이 들어오는" 느낌을 살립니다.
 */
export default function MissionCreditToPiggyOverlay({ playId, onFinish }: Props) {
  useEffect(() => {
    const end = window.setTimeout(() => onFinish(), 1600)
    return () => window.clearTimeout(end)
  }, [playId, onFinish])

  return (
    <div className="pointer-events-none absolute inset-0 z-[25] overflow-visible" aria-hidden>
      {/**
       * 시작점은 상단 쪽, 이동은 CSS `mission-credit-to-piggy-anim` 에서 담당합니다.
       * 가로는 풍경 밴드 중앙으로 고정해, 다양한 해상도에서도 섬 중앙선과 어긋나지 않게 맞춥니다.
       */}
      <div className="absolute left-1/2 top-[20%] -translate-x-1/2">
        <div key={playId} className="mission-credit-to-piggy-anim relative h-[108px] w-[108px]">
          {/**
           * 반짝임·라이트 박스:
           * - 코인 더미 바로 위/주변에 두어 이동 중에도 함께 반짝이게 보이도록 고정합니다.
           */}
          <div className="pointer-events-none absolute left-1/2 top-[38%] z-[2] h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2">
            <div className="mission-credit-lights pointer-events-none absolute left-1/2 top-0 z-[3] [transform:translate3d(-50%,4px,0)]">
              <SpriteImage
                sheet={EFFECT_LIGHTS}
                frame="lights"
                width={52}
                className="select-none drop-shadow-[0_0_16px_rgba(255,210,100,0.9)]"
              />
            </div>
            <div className="mission-credit-lights-b pointer-events-none absolute left-[calc(50%+12px)] top-[6px] z-[2] opacity-90">
              <SpriteImage
                sheet={EFFECT_LIGHTS}
                frame="lights"
                width={44}
                className="select-none drop-shadow-[0_0_12px_rgba(255,230,160,0.65)]"
              />
            </div>
            {TWINKLE_SPECS.map((spec, i) => (
              <div
                key={`${playId}-tw-${i}`}
                className={`${spec.cls} pointer-events-none absolute left-1/2 top-1/2 z-[8]`}
              >
                <SpriteImage
                  sheet={EFFECT_TWINKLE}
                  frame="twinkle"
                  width={spec.width}
                  className="select-none drop-shadow-[0_0_9px_rgba(255,235,170,0.95)]"
                />
              </div>
            ))}
          </div>

          {/** 동전 세 장이 짧은 간격으로 튀어 오르며 포개지는 느낌 */}
          {[0, 1, 2].map((i) => (
            <span
              key={`${playId}-c-${i}`}
              className="pointer-events-none absolute left-1/2 z-[6]"
              style={{ bottom: `${3 + i * 12}px` }}
            >
              <span className={`mission-credit-stack-layer-${i} inline-block -translate-x-1/2`}>
                <SpriteImage
                  sheet={ICONS}
                  frame="credits"
                  width={48 - i * 4}
                  clipRotated={false}
                  className="select-none drop-shadow-[0_4px_14px_rgba(0,0,0,0.2)]"
                />
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
