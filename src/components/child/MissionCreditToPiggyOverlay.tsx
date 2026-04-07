'use client'

import { useEffect, type CSSProperties } from 'react'
import SpriteImage from '@/components/common/SpriteImage'
import { EFFECT_LIGHTS, EFFECT_TWINKLE, ICONS } from '@/constants/sprites'

type Props = {
  /** 부모가 바꿀 때마다 애니메이션 처음부터 다시 */
  playId: number
  /** 연출 종료 후 호출 — 오버레이 언마운트용 */
  onFinish: () => void
  /** 카드 클릭 지점(뷰포트 px) */
  startX: number
  startY: number
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
 * - 동전 **한 개**가 카드 영역 쪽(아래)에서 시작해, 상단 크레딧 더미가 있는 방향(위)으로 슬라이딩합니다.
 * - 이동 중 라이트/트윙클을 같이 보여 "크레딧이 상단 더미로 흡수되는" 느낌을 살립니다.
 */
export default function MissionCreditToPiggyOverlay({ playId, onFinish, startX, startY }: Props) {
  useEffect(() => {
    const end = window.setTimeout(() => onFinish(), 1600)
    return () => window.clearTimeout(end)
  }, [playId, onFinish])

  /**
   * CSS 변수로 시작/도착 좌표를 전달합니다.
   * - 시작: 클릭한 카드 중심
   * - 도착: 상단 중앙 크레딧 더미 근처
   */
  const flightStyle = {
    ['--fx-start-x' as string]: `${startX}px`,
    ['--fx-start-y' as string]: `${startY}px`,
    ['--fx-end-x' as string]: '50vw',
    ['--fx-end-y' as string]: '31vh',
    ['--fx-arc-x' as string]: startX < 240 ? '28px' : '-28px',
    ['--fx-arc-y' as string]: '-58px',
  } as CSSProperties

  return (
    <div className="pointer-events-none fixed inset-0 z-[120] overflow-visible" aria-hidden>
      {/**
       * 시작점/도착점은 CSS 변수로 전달하고,
       * 실제 궤적(포물선)은 `mission-credit-to-piggy-anim` 키프레임에서 계산합니다.
       */}
      <div key={playId} className="mission-credit-to-piggy-anim absolute h-[96px] w-[96px]" style={flightStyle}>
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

          {/** 요청 반영: 더미(credits) 대신 동전 한 개(credit)만 표시 */}
          <span className="pointer-events-none absolute left-1/2 bottom-[10px] z-[6] -translate-x-1/2">
            <span className="mission-credit-single-coin inline-block">
              <SpriteImage
                sheet={ICONS}
                frame="credit"
                width={42}
                clipRotated={false}
                className="select-none drop-shadow-[0_4px_14px_rgba(0,0,0,0.2)]"
              />
            </span>
          </span>
      </div>
    </div>
  )
}
