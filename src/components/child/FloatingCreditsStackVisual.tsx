'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import SpriteImage from '@/components/common/SpriteImage'
import { MISSION_CREDITS_STAGE_CAP } from '@/constants/piggyBankStages'
import { EFFECT_LIGHTS } from '@/constants/sprites'

type Props = {
  /** 섬에 아직 나누지 않은 크레딧(가용) — 많을수록 동전 단계·크기가 올라갑니다 */
  floating: number
  /** 0일 때 흐리게(버튼 비활성과 맞춤) */
  dimWhenEmpty?: boolean
  /** 한 칸을 화면에 보여 줄 때 가로 크기(px) */
  displayWidth?: number
  className?: string
  /**
   * true: 이미지를 프레임(박스)의 세로·가로 중앙에 둡니다(옮기기 시트 카드 등).
   * false(기본): 섬 가운데용으로 아래쪽 기준 + 살짝 내림(`CREDIT_NUDGE_DOWN_PX`).
   */
  centerInFrame?: boolean
}

/** 저금통 단계와 맞춘 상한(`piggyBankStages`) — 넘치면 마지막(`credit10`) 그림·크기로 고정 */
const MAX_FLOATING_FOR_STAGE = MISSION_CREDITS_STAGE_CAP

/**
 * 시각 단계 1~10 → `public/assets/img/items/rewards/creditN.png` (아틀라스 없이 개별 파일).
 * 인덱스 0 = credit1 … 9 = credit10.
 */
const COIN_STAGE_IMAGE_URLS: ReadonlyArray<string> = Array.from({ length: 10 }, (_, i) => {
  const n = i + 1
  return `/assets/img/items/rewards/credit${n}.png`
})

const COIN_STAGE_COUNT = COIN_STAGE_IMAGE_URLS.length

/** PNG 비율이 제각각이라 레이아웃만 맞출 때 쓰는 대략적인 세로/가로 비율(높이 쪽이 조금 더 김) */
const CREDIT_IMAGE_LAYOUT_HEIGHT_RATIO = 1.12

/**
 * 표시 너비(`coinSpriteWidth`)를 기준으로, 잘리지 않게 잡는 예상 높이(px).
 * 실제 그림은 `object-contain` 으로 이 박스 안에 들어갑니다.
 */
function estimatedCreditImageHeightPx(targetWidth: number): number {
  const w = Math.max(22, Math.round(targetWidth))
  return Math.max(1, Math.round(w * CREDIT_IMAGE_LAYOUT_HEIGHT_RATIO))
}

/** 번짐 그림자·아래로 살짝 내린 연출이 박스 밖으로 나가도 잘리지 않게 하는 여백(px) */
const BLEED_X = 20
const BLEED_Y_TOP = 18
const BLEED_Y_BOTTOM = 38

/** 섬 가운데: 동전을 살짝 아래로 내려 맵과 맞출 때 쓰는 px(높이 박스에 포함) */
const CREDIT_NUDGE_DOWN_PX = 20

type LightFx = {
  leftPct: number
  topPct: number
  sizeMul: number
  delayMs: number
  durationMs: number
  opacity: number
}

/**
 * 0크레딧 → 단계 0 → `credit1`(가장 작은 더미 느낌).
 * 1~MAX → `ceil(amount * 10 / MAX) - 1` 로 0~9 (예: 1~100 → credit1, 901~1000 → credit10).
 */
function coinStageIndex(amount: number): number {
  if (amount <= 0) return 0
  const a = Math.min(Math.floor(amount), MAX_FLOATING_FOR_STAGE)
  return Math.min(COIN_STAGE_COUNT - 1, Math.ceil((a * COIN_STAGE_COUNT) / MAX_FLOATING_FOR_STAGE) - 1)
}

/**
 * 같은 단계 안에서 금액이 늘수록 0→1로 커지게 함.
 * 단계 s 구간: [floor(s*MAX/10)+1, floor((s+1)*MAX/10)].
 */
function intraStageProgress(amount: number, stage: number): number {
  if (amount <= 0) return 0
  const max = MAX_FLOATING_FOR_STAGE
  const low = Math.floor((stage * max) / COIN_STAGE_COUNT) + 1
  const high = Math.floor(((stage + 1) * max) / COIN_STAGE_COUNT)
  const a = Math.min(amount, high)
  if (high < low) return 1
  return Math.min(1, Math.max(0, (a - low) / (high - low)))
}

/**
 * 단계별(인덱스 0=credit1 … 9=credit10) 최소·최대 배율(`displayWidth` 기준).
 * 단계가 올라갈수록 더 크게, 같은 단계 안에서는 t로 min→max 보간.
 */
const STAGE_SCALE_MIN = [0.4, 0.45, 0.51, 0.57, 0.63, 0.69, 0.76, 0.82, 0.9, 0.98] as const
const STAGE_SCALE_MAX = [0.5, 0.58, 0.66, 0.74, 0.82, 0.9, 0.99, 1.08, 1.18, 1.28] as const

/**
 * 가운데 가용 크레딧: 동전 PNG 10단계, 구간 안에서는 크기만 부드럽게 증가.
 */
export default function FloatingCreditsStackVisual({
  floating,
  dimWhenEmpty = true,
  displayWidth = 58,
  className = '',
  centerInFrame = false,
}: Props) {
  const targetCredit = Math.max(0, Math.min(Math.floor(floating), MAX_FLOATING_FOR_STAGE))
  const [displayedCredit, setDisplayedCredit] = useState(targetCredit)

  /** 실제 숫자가 갑자기 바뀌어도 화면 숫자처럼 조금씩 따라가게 해서 단계 전환이 여러 번 보이게 함 */
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

  /** 크레딧이 늘어났을 때만 짧은 반짝임(빛 스프라이트) */
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

  const clamped = Math.max(0, Math.min(displayedCredit, MAX_FLOATING_FOR_STAGE))
  const stage = coinStageIndex(clamped)
  const creditImageSrc = COIN_STAGE_IMAGE_URLS[stage]!
  const t = intraStageProgress(clamped, stage)

  const smin = STAGE_SCALE_MIN[stage]
  const smax = STAGE_SCALE_MAX[stage]
  const mul = smin + (smax - smin) * t
  const coinSpriteWidth = Math.max(22, Math.round(displayWidth * mul))

  const rh = estimatedCreditImageHeightPx(coinSpriteWidth)
  const rw = coinSpriteWidth
  const layoutWidth = Math.ceil(rw + BLEED_X)
  const displayHeight = centerInFrame
    ? Math.ceil(rh + BLEED_Y_TOP + BLEED_Y_BOTTOM + 10)
    : Math.ceil(rh + CREDIT_NUDGE_DOWN_PX + BLEED_Y_TOP + BLEED_Y_BOTTOM)

  const opacityClass = targetCredit <= 0 && dimWhenEmpty ? 'opacity-30' : 'opacity-100'

  /** 동전 그림이 바뀔 때(단계 전환) 짧게 살짝 줄었다가 돌아오는 느낌 */
  const visualKey = `coin-${stage}-${creditImageSrc}`

  useEffect(() => {
    setIsMorphing(true)
    const off = setTimeout(() => setIsMorphing(false), 240)
    return () => clearTimeout(off)
  }, [visualKey])

  const morphClass = `transition-[opacity,transform] duration-300 ease-out ${isMorphing ? 'opacity-70' : 'opacity-100'}`
  const morphTransform = (extra: string) =>
    `${extra} ${isMorphing ? 'scale(0.98)' : 'scale(1)'}`

  const anchorYClass = centerInFrame ? 'top-1/2' : 'bottom-0'
  const anchorTransform = (extra: string) =>
    centerInFrame
      ? morphTransform(`translate(-50%, -50%) ${extra}`.trim())
      : morphTransform(`translateX(-50%) translateY(${CREDIT_NUDGE_DOWN_PX}px) ${extra}`.trim())

  const outerShellClass = [
    'relative inline-flex max-w-none shrink-0 flex-col items-center overflow-visible px-1.5 pb-2 pt-1.5',
    className.trim() || 'drop-shadow-[0_3px_12px_rgba(0,0,0,0.16)]',
    opacityClass,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={outerShellClass} aria-hidden>
      <div className="relative overflow-visible" style={{ width: layoutWidth, height: displayHeight }}>
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

        <span
          className={`absolute left-1/2 ${anchorYClass} ${morphClass}`}
          style={{
            transform: anchorTransform(''),
          }}
        >
          {/**
           * `width`/`height` 는 Next/Image 필수값 — 실제 표시는 `style.width` + `h-auto` 로 맞춤.
           * `sizes` 는 뷰포트 대비 이 컴포넌트가 쓰는 대략적인 너비 힌트입니다.
           */}
          <Image
            src={creditImageSrc}
            alt=""
            width={256}
            height={256}
            sizes={`${coinSpriteWidth}px`}
            className="h-auto max-w-none select-none object-contain object-bottom"
            style={{ width: coinSpriteWidth, height: 'auto' }}
          />
        </span>
      </div>
    </div>
  )
}
