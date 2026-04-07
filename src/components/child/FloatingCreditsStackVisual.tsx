'use client'

import { useEffect, useRef, useState } from 'react'
import SpriteImage from '@/components/common/SpriteImage'
import { EFFECT_LIGHTS, REWARD_CREDITS } from '@/constants/sprites'

type Props = {
  /** 섬에 아직 나누지 않은 크레딧(가용) — 많을수록 더 풍성한 단계 이미지 */
  floating: number
  /** 0일 때 흐리게(버튼 비활성과 맞춤) */
  dimWhenEmpty?: boolean
  /** 한 칸을 화면에 보여 줄 때 가로 크기(px) */
  displayWidth?: number
  className?: string
}

const MAX_CREDIT_STAGE = 500
const CREDIT_STEP = 30
type LightFx = { leftPct: number; topPct: number; sizeMul: number; delayMs: number; durationMs: number; opacity: number }

/**
 * 크레딧 0~299 구간: `credit1`~`credit10` 프레임으로 단계 표시.
 * - 30 단위로 다음 단계로 넘어가며, 0도 1단계(`credit1`)로 보입니다.
 */
function creditTierFrameName(floating: number): string {
  const clamped = Math.max(0, Math.min(floating, 299))
  const tier = Math.min(10, Math.floor(clamped / CREDIT_STEP) + 1)
  /**
   * 아틀라스 원본에 `credit5~7` 프레임이 없어,
   * 중간 단계는 인접 프레임으로 자연스럽게 보간해 사용합니다.
   */
  const tierToFrame: Record<number, string> = {
    1: 'credit1',
    2: 'credit2',
    3: 'credit3',
    4: 'credit4',
    5: 'credit4',
    6: 'credit8',
    7: 'credit8',
    8: 'credit8',
    9: 'credit9',
    10: 'credit10',
  }
  return tierToFrame[tier] ?? 'credit1'
}

/**
 * 아이 미션 섬 가운데: 크레딧이 쌓일수록 동전 더미가 겹쳐 보이게 렌더링합니다.
 * - 기존 그리드 크롭 방식(잘림 이슈)을 제거해, 어떤 화면에서도 안정적으로 보입니다.
 */
export default function FloatingCreditsStackVisual({
  floating,
  dimWhenEmpty = true,
  displayWidth = 58,
  className = '',
}: Props) {
  /** 요청사항: 크레딧 시각 단계 최대값은 500으로 제한합니다. */
  const targetCredit = Math.max(0, Math.min(floating, MAX_CREDIT_STAGE))
  const prevCreditRef = useRef(targetCredit)
  const [sparkleOn, setSparkleOn] = useState(false)
  const [lightFx, setLightFx] = useState<LightFx[]>([])
  const [isMorphing, setIsMorphing] = useState(false)

  useEffect(() => {
    /**
     * 크레딧이 늘어나면 3초 동안만 반짝임을 켭니다.
     * 줄어들 때는 반짝임 없이 단계만 부드럽게 내려갑니다.
     */
    if (targetCredit > prevCreditRef.current) {
      /**
       * 매번 같은 자리에만 뜨지 않게, 증가 이벤트마다 라이트 위치/속도를 랜덤으로 다시 뽑습니다.
       */
      setLightFx(
        Array.from({ length: 4 }).map(() => ({
          leftPct: 20 + Math.random() * 60,
          topPct: 4 + Math.random() * 30,
          sizeMul: 0.62 + Math.random() * 0.58,
          delayMs: Math.floor(Math.random() * 520),
          durationMs: 1200 + Math.floor(Math.random() * 1400),
          opacity: 0.45 + Math.random() * 0.4,
        })),
      )
      setSparkleOn(true)
      const off = setTimeout(() => setSparkleOn(false), 3000)
      prevCreditRef.current = targetCredit
      return () => clearTimeout(off)
    }
    prevCreditRef.current = targetCredit
    return
  }, [targetCredit])

  const clamped = targetCredit
  /**
   * 크레딧이 늘수록 이미지가 커지게 하되,
   * 0일 때는 "빈 상태"가 과하게 커 보이지 않도록 시작 배율을 더 작게 잡습니다.
   * - 0크레딧: 약 0.68x
   * - 500크레딧: 약 1.30x
   */
  const growthScale = 0.68 + (clamped / MAX_CREDIT_STAGE) * 0.62
  const grownWidth = Math.round(displayWidth * growthScale)
  /**
   * `credit2`처럼 회전 프레임은 세로 비율이 커서 기본 높이(0.92배)로는 상단이 잘릴 수 있습니다.
   * 작은 화면에서도 잘리지 않게 표시 박스 높이를 넉넉히 잡습니다.
   */
  const displayHeight = Math.round(grownWidth * 1.8)

  const opacityClass = floating <= 0 && dimWhenEmpty ? 'opacity-30' : 'opacity-100'
  const isFinal = clamped >= 500
  const isGoldBoxPhase = clamped >= 300 && clamped < 500
  const showCrown = clamped >= 400 && clamped < 500
  const diamondCount = isGoldBoxPhase ? Math.max(0, Math.floor((clamped - 300) / CREDIT_STEP)) : 0
  const creditFrame = creditTierFrameName(clamped)
  const visualKey = isFinal ? 'final' : isGoldBoxPhase ? `goldbox-${diamondCount}-${showCrown ? 'crown' : 'nocrown'}` : `credit-${creditFrame}`

  useEffect(() => {
    /** 단계 이미지가 바뀔 때 바로 점프하지 않게 짧은 모핑(페이드+스케일)을 넣습니다. */
    setIsMorphing(true)
    const off = setTimeout(() => setIsMorphing(false), 240)
    return () => clearTimeout(off)
  }, [visualKey])

  return (
    <div
      className={`relative shrink-0 ${opacityClass} ${className}`.trim()}
      style={{ width: displayWidth, height: displayHeight }}
      aria-hidden
    >
      {sparkleOn ? (
        <>
          {lightFx.map((fx, i) => (
            <span
              key={`credit-light-${i}`}
              className="pointer-events-none absolute -translate-x-1/2 animate-ping"
              style={{
                left: `${fx.leftPct}%`,
                top: `${fx.topPct}%`,
                animationDuration: `${fx.durationMs}ms`,
                animationDelay: `${fx.delayMs}ms`,
                animationIterationCount: 3,
              }}
            >
              <SpriteImage
                sheet={EFFECT_LIGHTS}
                frame="lights"
                width={Math.max(14, Math.round(displayWidth * fx.sizeMul))}
                className="select-none"
                style={{ opacity: fx.opacity }}
              />
            </span>
          ))}
        </>
      ) : null}
      {/** 500 달성: 최종 프레임 `gold_and_crown` 단일 표시 */}
      {isFinal ? (
        <span
          className={`absolute left-1/2 bottom-0 transition-all duration-300 ${isMorphing ? 'opacity-70 scale-[0.98]' : 'opacity-100 scale-100'}`}
          style={{ transform: 'translateX(-50%)' }}
        >
          <SpriteImage
            sheet={REWARD_CREDITS}
            frame="gold_and_crown"
            width={Math.max(48, Math.round(grownWidth * 1.15))}
            clipRotated={false}
            className="select-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.18)]"
          />
        </span>
      ) : isGoldBoxPhase ? (
        <>
          <span
            className={`absolute left-1/2 bottom-0 transition-all duration-300 ${isMorphing ? 'opacity-70 scale-[0.98]' : 'opacity-100 scale-100'}`}
            style={{ transform: 'translateX(-50%)' }}
          >
            <SpriteImage
              sheet={REWARD_CREDITS}
              frame="gold_box"
              width={Math.max(42, Math.round(grownWidth))}
              clipRotated={false}
              className="select-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.18)]"
            />
          </span>
          {Array.from({ length: diamondCount }).map((_, i) => (
            <span
              key={`diamond-${i}`}
              className="absolute left-1/2"
              style={{
                bottom: Math.max(6, Math.round(displayHeight * 0.38 + i * 2)),
                transform: `translateX(${(i - (diamondCount - 1) / 2) * 10}px)`,
              }}
            >
              <SpriteImage
                sheet={REWARD_CREDITS}
                frame="diamond"
                width={Math.max(14, Math.round(grownWidth * 0.24))}
                clipRotated={false}
                className="select-none"
              />
            </span>
          ))}
          {showCrown ? (
            <span
              className="absolute left-1/2"
              style={{ bottom: Math.max(16, Math.round(displayHeight * 0.64)), transform: 'translateX(-50%)' }}
            >
              <SpriteImage
                sheet={REWARD_CREDITS}
                frame="crown"
                width={Math.max(18, Math.round(grownWidth * 0.3))}
                clipRotated={false}
                className="select-none"
              />
            </span>
          ) : null}
        </>
      ) : (
        <span
          className={`absolute left-1/2 bottom-0 transition-all duration-300 ${isMorphing ? 'opacity-70 scale-[0.98]' : 'opacity-100 scale-100'}`}
          style={{ transform: 'translateX(-50%)' }}
        >
          <SpriteImage
            sheet={REWARD_CREDITS}
            frame={creditFrame}
            width={Math.max(36, Math.round(grownWidth))}
            clipRotated={false}
            className="select-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.18)]"
          />
        </span>
      )}
    </div>
  )
}
