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

/** 저금통 단계와 맞춘 상한(`piggyBankStages`) — 넘치면 마지막(`home_credit10`) 그림·크기로 고정 */
const MAX_FLOATING_FOR_STAGE = MISSION_CREDITS_STAGE_CAP

/**
 * 시각 단계 1~10 → `public/assets/img/items/rewards/home/home_creditN.png` (아틀라스 없이 개별 파일).
 * 인덱스 0 = home_credit1 … 9 = home_credit10.
 * 비개발자 관점으로 보면, 크레딧이 늘수록 1번 그림에서 10번 그림으로 천천히 바뀝니다.
 */
const COIN_STAGE_IMAGE_URLS: ReadonlyArray<string> = Array.from({ length: 10 }, (_, i) => {
  const n = i + 1
  return `/assets/img/items/rewards/home/home_credit${n}.png`
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
 * 0크레딧 → 단계 0 → `home_credit1`(가장 작은 더미 느낌).
 * 1~MAX → `ceil(amount * 10 / MAX) - 1` 로 0~9
 * (예: 1~100 → home_credit1, 901~1000 → home_credit10, MAX는 현재 1000).
 */
function coinStageIndex(amount: number): number {
  if (amount <= 0) return 0
  const a = Math.min(Math.floor(amount), MAX_FLOATING_FOR_STAGE)
  return Math.min(COIN_STAGE_COUNT - 1, Math.ceil((a * COIN_STAGE_COUNT) / MAX_FLOATING_FOR_STAGE) - 1)
}

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
  /**
   * 요청사항 반영:
   * - 돈이 많아질수록 가운데 크레딧이 점점 커지게 합니다.
   * - `displayWidth`를 기준 크기로 두고, 0~MAX(1000) 비율에 따라 부드럽게 확대합니다.
   * - 너무 작거나 너무 커 보이지 않게 최소/최대 배율을 제한합니다.
   */
  const creditRatio = clamped / Math.max(1, MAX_FLOATING_FOR_STAGE)
  const scaleMin = 0.72
  const scaleMax = 1.2
  const sizeMul = scaleMin + (scaleMax - scaleMin) * creditRatio
  const coinSpriteWidth = Math.max(22, Math.round(displayWidth * sizeMul))

  const rh = estimatedCreditImageHeightPx(coinSpriteWidth)
  const rw = coinSpriteWidth
  const layoutWidth = Math.ceil(rw + BLEED_X)
  const displayHeight = centerInFrame
    ? Math.ceil(rh + BLEED_Y_TOP + BLEED_Y_BOTTOM + 10)
    : Math.ceil(rh + CREDIT_NUDGE_DOWN_PX + BLEED_Y_TOP + BLEED_Y_BOTTOM)

  const opacityClass = targetCredit <= 0 && dimWhenEmpty ? 'opacity-30' : 'opacity-100'

  /**
   * 요청사항:
   * - 처음 렌더링 시 흐리게 보였다가 진해지는(opacity/scale 모핑) 느낌을 제거합니다.
   * - 따라서 동전 이미지는 항상 `opacity-100` + 고정 스케일로 즉시 표시합니다.
   */
  const morphClass = 'opacity-100'

  const anchorYClass = centerInFrame ? 'top-1/2' : 'bottom-0'
  const anchorTransform = (extra: string) =>
    centerInFrame
      ? `translate(-50%, -50%) ${extra}`.trim()
      : `translateX(-50%) translateY(${CREDIT_NUDGE_DOWN_PX}px) ${extra}`.trim()

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
