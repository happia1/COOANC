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

/** 0~299: 동전 1개 → 동전 더미까지 (금괴 프레임 제외, 순수 크레딧 쌓임만) */
const COIN_STACK_FRAMES: readonly string[] = [
  'credit1',
  'credit2',
  'credit3',
  'credit4',
  'credit8',
  'credit9',
  'credit10',
]

/** 300~: 상자 옆에 다이아 1개만 표시(금액이 이 구간에 들어오면) */

/** 왕관 단계 시작(상자+다이아 이후, 상자 위·크레딧 더미 위) */
const CROWN_FROM = 328

/** 금괴가 하나씩 붙기 시작 */
const GOLDBAR_FROM = 358
const GOLDBAR_EVERY = 16
const MAX_GOLDBARS = 3

/** 왕관+금괴+보석(다이아)+상자 풀 연출 강조 구간 */
const FULL_TABLEAU_FROM = 430

const GOLDBAR_FRAMES: readonly string[] = ['goldber1', 'goldbar2', 'goldbar5']

/**
 * 상자 옆·위 장식(다이아·왕관·금괴)을 동전/숫자 쪽으로 더 내릴 때 쓰는 px.
 * (`bottom` 값에서 빼면 화면 아래로 내려감)
 */
const LUXURY_ORNAMENTS_EXTRA_DOWN_PX = 24

/**
 * 왕관만 다이아·금괴보다 더 아래로 (상자·동전 숫자 쪽으로).
 * 다이아/금괴와 겹치지 않게 `bottom` 에서만 추가로 뺍니다.
 */
const CROWN_ONLY_EXTRA_DOWN_PX = 20

type LightFx = {
  leftPct: number
  topPct: number
  sizeMul: number
  delayMs: number
  durationMs: number
  opacity: number
}

/**
 * 0~299: 금액에 따라 동전 단계(한 장 → 많이 쌓임).
 * `clamped` 최대가 299이므로 분모는 **299**로 맞춰 0~8 인덱스가 정확히 끝까지 쓰이게 함.
 */
function coinStackFrame(floating: number): string {
  const clamped = Math.max(0, Math.min(floating, 299))
  if (clamped <= 0) return COIN_STACK_FRAMES[0]
  const idx = Math.min(
    COIN_STACK_FRAMES.length - 1,
    Math.floor((clamped / 299) * (COIN_STACK_FRAMES.length - 1)),
  )
  return COIN_STACK_FRAMES[idx] ?? 'credit1'
}

/**
 * 0~299: 한 개짜리 작은 동전에서 → 많이 쌓인 큰 더미로 **보이도록** 연속 배율(프레임과 별개로 크기가 점점 커짐).
 */
function coinStackSizeMul(floating: number): number {
  const clamped = Math.max(0, Math.min(floating, 299))
  if (clamped <= 0) return 0.52
  const t = clamped / 299
  return 0.52 + t * 0.88
}

/**
 * 아이 미션 섬 가운데 가용 크레딧 시각:
 * - 0~299: 동전 1개 → 여러 개 쌓인 더미
 * - 300~499: 상자 → 옆에 큰 다이아 증가 → 왕관(큼) 상자 위 → 금괴 증가 → 마지막에 모두 풀
 * - 500: 기존 `gold_and_crown` 단일 프레임
 */
export default function FloatingCreditsStackVisual({
  floating,
  dimWhenEmpty = true,
  displayWidth = 58,
  className = '',
}: Props) {
  /** 서버/부모가 준 **실제** 가용 크레딧(정수) */
  const targetCredit = Math.max(0, Math.min(Math.floor(floating), MAX_CREDIT_STAGE))
  /**
   * 그림(동전·상자)에 쓰는 **표시** 크레딧 — 목표로 바로 점프하지 않고 숫자(`SlotNumber`)처럼
   * 짧은 간격으로 한 단계씩 맞춰 가며, 티어·크기가 **여러 번** 바뀌어 보이게 함.
   */
  const [displayedCredit, setDisplayedCredit] = useState(targetCredit)

  useEffect(() => {
    if (displayedCredit === targetCredit) return
    const tick = setInterval(() => {
      setDisplayedCredit((prev) => {
        if (prev === targetCredit) return prev
        const diff = targetCredit - prev
        const step = Math.max(1, Math.floor(Math.abs(diff) / 8))
        return prev + Math.sign(diff) * step
      })
    }, 45)
    return () => clearInterval(tick)
  }, [targetCredit, displayedCredit])

  const prevCreditRef = useRef(targetCredit)
  const [sparkleOn, setSparkleOn] = useState(false)
  const [lightFx, setLightFx] = useState<LightFx[]>([])
  const [isMorphing, setIsMorphing] = useState(false)

  useEffect(() => {
    if (targetCredit > prevCreditRef.current) {
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

  /** 스프라이트·티어 계산은 **표시값** 기준(목표로 점프하지 않음) */
  const clamped = Math.max(0, Math.min(displayedCredit, MAX_CREDIT_STAGE))
  const MIN_GROW = 0.48
  const MAX_GROW = 1.34
  let growthScale = MIN_GROW + (clamped / MAX_CREDIT_STAGE) * (MAX_GROW - MIN_GROW)
  if (clamped > 0 && clamped < 20) {
    growthScale *= 0.88
  }
  const grownWidth = Math.round(displayWidth * growthScale)

  const isFinal = clamped >= 500
  const isGoldBoxPhase = clamped >= 300 && clamped < 500
  const isCoinPhase = clamped < 300

  /** 동전 단계: 베이스 × 쌓임 연출 배율 → 한 개는 작고, 299에 가까울수록 크게 */
  const coinSizeMul = coinStackSizeMul(clamped)
  const coinSpriteWidth = isCoinPhase
    ? Math.max(26, Math.round(grownWidth * coinSizeMul))
    : grownWidth

  /** 금고·왕관·금괴 레이아웃은 가로가 넓어야 옆 다이아·금괴가 들어감 */
  const layoutWidth = isGoldBoxPhase
    ? Math.max(grownWidth, Math.round(grownWidth * 2.75))
    : Math.max(grownWidth, Math.round(coinSpriteWidth * 1.05))
  const displayHeight = isGoldBoxPhase
    ? Math.round(grownWidth * 2.35)
    : Math.round(Math.max(grownWidth, coinSpriteWidth) * 1.95)

  const opacityClass = targetCredit <= 0 && dimWhenEmpty ? 'opacity-30' : 'opacity-100'

  const creditFrame = coinStackFrame(clamped)
  const r300 = clamped - 300
  /** 상자 구간: 다이아는 1개만, 약간 기울인 연출 */
  const showSingleDiamond = isGoldBoxPhase && r300 >= 0
  const showCrown = isGoldBoxPhase && clamped >= CROWN_FROM
  const goldBarCount =
    isGoldBoxPhase && clamped >= GOLDBAR_FROM
      ? Math.min(MAX_GOLDBARS, Math.floor((clamped - GOLDBAR_FROM) / GOLDBAR_EVERY) + 1)
      : 0
  const fullTableau = isGoldBoxPhase && clamped >= FULL_TABLEAU_FROM

  /**
   * React `key` 용도: **크레딧 숫자가 1씩 바뀔 때마다** 바뀌면 스프라이트가 통째로 **리마운트**되어
   * `transition` 으로 크기가 부드럽게 커지는 연출이 사라짐. `clamped`·픽셀 크기는 넣지 않고
   * **스프라이트 티어(프레임/왕관/금괴 단계)**만 바뀔 때만 키를 바꿈.
   */
  const visualKey = isFinal
    ? 'final'
    : isGoldBoxPhase
      ? `lux-d1-${showCrown ? 1 : 0}-${goldBarCount}-f${fullTableau ? 1 : 0}`
      : `coin-${creditFrame}`

  useEffect(() => {
    setIsMorphing(true)
    const off = setTimeout(() => setIsMorphing(false), 240)
    return () => clearTimeout(off)
  }, [visualKey])

  /** 상자 스프라이트 가로(화면 기준) */
  const boxW = Math.max(42, Math.round(grownWidth * 1.02))
  const boxHApprox = Math.round(boxW * (190 / 205))
  /** 옆 다이아: 큰 사이즈 */
  const diamondPx = Math.max(34, Math.round(grownWidth * 0.62))
  /** 왕관: 예전 대비 약 3배 체감 (기존 ~0.3 → ~0.9) */
  const crownPx = Math.max(56, Math.round(grownWidth * 0.92))
  const goldBarPx = Math.max(28, Math.round(grownWidth * 0.42))

  /** 너비·높이가 바뀔 때도 부드럽게(리마운트 없이 같은 DOM에 width 전달) */
  const sizeTransitionClass = 'transition-[width,height] duration-500 ease-out'
  const morphClass = `transition-[opacity,transform] duration-300 ease-out ${sizeTransitionClass} ${isMorphing ? 'opacity-70' : 'opacity-100'}`
  const morphTransform = (extra: string) =>
    `${extra} ${isMorphing ? 'scale(0.98)' : 'scale(1)'}`

  /** 크레딧·상자 묶음을 살짝 아래로 내려 섬 레이아웃과 맞춤(px) — 섬에서 가용 크레딧 블록을 더 내릴 때 함께 키움 */
  const CREDIT_NUDGE_DOWN_PX = 20

  return (
    <div
      className={`relative shrink-0 ${opacityClass} ${className} ${sizeTransitionClass}`.trim()}
      style={{ width: layoutWidth, height: displayHeight }}
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

      {isFinal ? (
        <span
          key={visualKey}
          className={`absolute left-1/2 bottom-0 ${morphClass}`}
          style={{
            transform: morphTransform(`translateX(-50%) translateY(${CREDIT_NUDGE_DOWN_PX}px)`),
          }}
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
          {/** 중앙: 보석 상자(금고) — 안에 크레딧 더미 느낌은 스프라이트에 포함 */}
          <span
            key={`${visualKey}-box`}
            className={`absolute left-1/2 bottom-0 ${morphClass}`}
            style={{
              transform: morphTransform(`translateX(-50%) translateY(${CREDIT_NUDGE_DOWN_PX}px)`),
            }}
          >
          <SpriteImage
            sheet={REWARD_CREDITS}
            frame="gold_box"
            width={boxW}
            clipRotated={false}
            className={`select-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.18)] ${sizeTransitionClass}`}
          />
          </span>

          {/** 상자 오른쪽: 다이아몬드 1개만, 기울기는 시계 방향(이전 -14° 반대) */}
          {showSingleDiamond ? (
            <span
              key={`${visualKey}-diamond`}
              className="absolute flex items-center justify-center"
              style={{
                left: `calc(50% + ${Math.round(boxW * 0.4)}px)`,
                bottom: Math.round(12 + CREDIT_NUDGE_DOWN_PX - LUXURY_ORNAMENTS_EXTRA_DOWN_PX),
                transform: 'translateX(-35%) rotate(16deg)',
                transformOrigin: 'center center',
              }}
            >
              <SpriteImage
                sheet={REWARD_CREDITS}
                frame="diamond"
                width={fullTableau ? Math.round(diamondPx * 1.06) : diamondPx}
                clipRotated={false}
                className="select-none drop-shadow-[0_3px_10px_rgba(0,0,0,0.2)]"
              />
            </span>
          ) : null}

          {/** 상자 위(크레딧 더미 위): 왕관 — 이전보다 약 3배 큰 사이즈 */}
          {showCrown ? (
            <span
              key={`${visualKey}-crown`}
              className={`absolute left-1/2 ${morphClass}`}
              style={{
                bottom: Math.round(
                  boxHApprox +
                    4 +
                    CREDIT_NUDGE_DOWN_PX -
                    LUXURY_ORNAMENTS_EXTRA_DOWN_PX -
                    CROWN_ONLY_EXTRA_DOWN_PX,
                ),
                transform: morphTransform('translateX(-50%)'),
                zIndex: 3,
              }}
            >
              <SpriteImage
                sheet={REWARD_CREDITS}
                frame="crown"
                width={fullTableau ? Math.round(crownPx * 1.05) : crownPx}
                clipRotated={false}
                className="select-none drop-shadow-[0_4px_14px_rgba(0,0,0,0.22)]"
              />
            </span>
          ) : null}

          {/** 상자 왼쪽: 금괴가 하나씩 늘어남 */}
          {goldBarCount > 0
            ? Array.from({ length: goldBarCount }).map((_, i) => {
                const barFrame = GOLDBAR_FRAMES[i % GOLDBAR_FRAMES.length] ?? 'goldbar2'
                return (
                  <span
                    key={`goldbar-${i}`}
                    className="absolute flex items-end justify-center"
                    style={{
                      left: `calc(50% - ${Math.round(boxW * 0.46)}px)`,
                      bottom: Math.round(
                        8 + i * (goldBarPx * 0.35) + CREDIT_NUDGE_DOWN_PX - LUXURY_ORNAMENTS_EXTRA_DOWN_PX,
                      ),
                      transform: 'translateX(-50%)',
                      zIndex: 2,
                    }}
                  >
                    <SpriteImage
                      sheet={REWARD_CREDITS}
                      frame={barFrame}
                      width={fullTableau ? Math.round(goldBarPx * 1.08) : goldBarPx}
                      clipRotated={false}
                      className="select-none drop-shadow-[0_3px_8px_rgba(0,0,0,0.18)]"
                    />
                  </span>
                )
              })
            : null}
        </>
      ) : (
        // 동전 구간: key 없이 같은 노드에서 frame·width 만 갱신(티어 바뀔 때 리마운트 최소화)
        <span
          className={`absolute left-1/2 bottom-0 ${morphClass}`}
          style={{
            transform: morphTransform(`translateX(-50%) translateY(${CREDIT_NUDGE_DOWN_PX}px)`),
          }}
        >
          <SpriteImage
            sheet={REWARD_CREDITS}
            frame={creditFrame}
            width={coinSpriteWidth}
            clipRotated={false}
            className={`select-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.18)] ${sizeTransitionClass}`}
          />
        </span>
      )}
    </div>
  )
}
