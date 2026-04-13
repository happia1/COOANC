'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import SpriteImage from '@/components/common/SpriteImage'
import { MISSION_CREDITS_STAGE_CAP, PIGGY_BANK_VISUAL_MAX_SCALE } from '@/constants/piggyBankStages'
import { missionCreditsProgressiveScaleMul } from '@/lib/missionCreditVisualProgressiveScale'
import { EFFECT_LIGHTS } from '@/constants/sprites'

type Props = {
  /** 돈바구니에 아직 나누지 않은 크레딧(가용) — 많을수록 동전 **그림 단계**만 바뀌고, 가로 크기는 저금통 최대와 맞춘 고정값입니다 */
  floating: number
  /** 0일 때 흐리게(버튼 비활성과 맞춤) */
  dimWhenEmpty?: boolean
  /** 한 칸을 화면에 보여 줄 때 가로 크기(px) */
  displayWidth?: number
  className?: string
  /**
   * true: 이미지를 프레임(박스)의 세로·가로 중앙에 둡니다(옮기기 시트 카드 등).
   * false(기본): 미션 가운데(돈바구니)용으로 아래쪽 기준 + 살짝 내림(`CREDIT_NUDGE_DOWN_PX`).
   */
  centerInFrame?: boolean
  /**
   * true: 미션 상단 카드처럼 **낮은 고정 높이** 안에 넣을 때 — 여백·전체 높이를 줄이고 항상 **아래 기준**으로만 둡니다.
   * (`centerInFrame` 이 true여도 `tightSlot` 이면 중앙 정렬을 쓰지 않아 블록 밖으로 밀려 나가지 않습니다.)
   */
  tightSlot?: boolean
  /** `tightSlot` 과 함께: 내부 레이아웃이 이 높이를 넘으면 **비율 축소**해 카드 안에 맞춥니다(px). */
  maxOuterHeightPx?: number
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

/**
 * `home_credit10`(마지막 동전 PNG)만 추가로 줄임 — 저금통 왕관 단계를 줄인 것과 비슷하게 맞춤.
 * (비개발자용) 크레딧이 가득 찼을 때 동전 그림이 너무 크게만 보이지 않게 합니다.
 */
const FLOATING_LAST_COIN_STAGE_VISUAL_MUL = 0.78 as const

/** PNG 비율이 제각각이라 레이아웃만 맞출 때 쓰는 대략적인 세로/가로 비율(높이 쪽이 조금 더 김) */
const CREDIT_IMAGE_LAYOUT_HEIGHT_RATIO = 1.12
/**
 * 미션 카드 `tightSlot`: `home_credit*.png` 가로 대비 세로가 들쭉날쭉해, 예상 높이를 넉넉히 잡습니다.
 * (`stageBox` 가 `overflow-hidden` 일 때 실제보다 박스가 짧으면 아래가 잘립니다.)
 */
const CREDIT_IMAGE_TIGHT_SLOT_HEIGHT_RATIO = 1.38

/**
 * 표시 너비(`coinSpriteWidth`)를 기준으로, 잘리지 않게 잡는 예상 높이(px).
 * 실제 그림은 `object-contain` 으로 이 박스 안에 들어갑니다.
 */
function estimatedCreditImageHeightPx(targetWidth: number, heightRatio = CREDIT_IMAGE_LAYOUT_HEIGHT_RATIO): number {
  const w = Math.max(22, Math.round(targetWidth))
  return Math.max(1, Math.round(w * heightRatio))
}

/** 번짐 그림자·아래로 살짝 내린 연출이 박스 밖으로 나가도 잘리지 않게 하는 여백(px) */
const BLEED_X = 20
const BLEED_Y_TOP = 18
const BLEED_Y_BOTTOM = 38

/** 미션 가운데(돈바구니): 동전을 살짝 아래로 내려 맵과 맞출 때 쓰는 px(높이 박스에 포함) */
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
 * 가운데 가용 크레딧: 동전 PNG 10단계.
 * - 그림 **기준 가로**는 `PIGGY_BANK_VISUAL_MAX_SCALE` 로 잡고, 마지막 PNG(`home_credit10`)만 `FLOATING_LAST_COIN_STAGE_VISUAL_MUL` 로 한 번 더 줄입니다.
 *   850 이상 잔액에서는 저금통과 같은 규칙(`missionCreditsProgressiveScaleMul`)으로 **추가 scale** 해 점점 커 보이게 합니다.
 * - 잔액이 바뀌면 **목표 단계**까지 `displayStage` 를 한 칸씩 올리거나 내려 미션 카드 저금통·지갑과 같은 리듬으로 맞춥니다.
 */
export default function FloatingCreditsStackVisual({
  floating,
  dimWhenEmpty = true,
  displayWidth = 58,
  className = '',
  centerInFrame = false,
  tightSlot = false,
  maxOuterHeightPx,
}: Props) {
  const targetCredit = Math.max(0, Math.min(Math.floor(floating), MAX_FLOATING_FOR_STAGE))
  /** 850~캡: 저금통과 동일 곡선으로 시각 크기만 키움(동전 단계와 별개) */
  const creditsVisualMul = missionCreditsProgressiveScaleMul(targetCredit)
  /** 잔액에 맞는 동전 그림 단계(0~9) — 실제 목표 */
  const targetStage = coinStageIndex(targetCredit)
  /** 화면에 그리는 단계 — `targetStage` 로 한 칸씩 따라감 */
  const [displayStage, setDisplayStage] = useState(() => coinStageIndex(targetCredit))
  const displayStageRef = useRef(displayStage)
  useEffect(() => {
    displayStageRef.current = displayStage
  }, [displayStage])

  useEffect(() => {
    if (targetStage === displayStageRef.current) return
    const tick = setInterval(() => {
      setDisplayStage((prev) => {
        if (prev === targetStage) return prev
        return prev + (targetStage > prev ? 1 : -1)
      })
    }, 150)
    return () => clearInterval(tick)
  }, [targetStage])

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

  const creditImageSrc = COIN_STAGE_IMAGE_URLS[displayStage]!
  /** 저금통이 가장 클 때와 같은 배율로만 너비를 잡아, 단계·잔액과 무관하게 한 덩어리 크기로 보입니다 */
  const coinSpriteWidth = Math.max(22, Math.round(displayWidth * PIGGY_BANK_VISUAL_MAX_SCALE))

  /** `tightSlot` 일 때는 동전 PNG 가 더 길 수 있어 비율만 살짝 올려 하단 클립을 막습니다 */
  const rh = estimatedCreditImageHeightPx(
    coinSpriteWidth,
    tightSlot ? CREDIT_IMAGE_TIGHT_SLOT_HEIGHT_RATIO : CREDIT_IMAGE_LAYOUT_HEIGHT_RATIO,
  )
  const rw = coinSpriteWidth
  /** 미션 카드 슬롯: 번짐·상하 여백을 줄여 한 블록 안에 들어가게 합니다. */
  const bleedX = tightSlot ? 10 : BLEED_X
  const bleedTop = tightSlot ? 6 : BLEED_Y_TOP
  /** 하단 번짐 — `tightSlot` 은 아래 앵커 연산과 맞춰 넉넉히 둡니다 */
  const bleedBottom = tightSlot ? 28 : BLEED_Y_BOTTOM
  const layoutWidth = Math.ceil(rw + bleedX)
  /**
   * `tightSlot` 높이에 예전처럼 `nudgeDown` 을 더하면 안 됩니다.
   * `bottom-0` 인 span 에 `translateY(양수)` 를 주면 그림이 박스 **아래**로 나가 `overflow-hidden` 에 잘립니다.
   * 미션 카드에서는 `translateY(0)` 만 쓰고, 아래 여백은 `bleedBottom` 으로만 잡습니다.
   */
  const displayHeight = tightSlot
    ? Math.ceil(rh + bleedTop + bleedBottom)
    : centerInFrame
      ? Math.ceil(rh + BLEED_Y_TOP + BLEED_Y_BOTTOM + 10)
      : Math.ceil(rh + CREDIT_NUDGE_DOWN_PX + BLEED_Y_TOP + BLEED_Y_BOTTOM)

  const opacityClass = targetCredit <= 0 && dimWhenEmpty ? 'opacity-30' : 'opacity-100'

  /**
   * 요청사항:
   * - 처음 렌더링 시 흐리게 보였다가 진해지는(opacity/scale 모핑) 느낌을 제거합니다.
   * - 따라서 동전 이미지는 항상 `opacity-100` + 고정 스케일로 즉시 표시합니다.
   */
  const morphClass = 'opacity-100'

  const useVerticalCenter = centerInFrame && !tightSlot
  const anchorYClass = useVerticalCenter ? 'top-1/2' : 'bottom-0'
  const anchorTransform = (extra: string) =>
    useVerticalCenter
      ? `translate(-50%, -50%) ${extra}`.trim()
      : `translateX(-50%) translateY(${tightSlot ? 0 : CREDIT_NUDGE_DOWN_PX}px) ${extra}`.trim()

  const outerShellClass = [
    tightSlot
      ? 'relative inline-flex max-w-none shrink-0 flex-col items-center overflow-visible px-0.5 pb-0 pt-0'
      : 'relative inline-flex max-w-none shrink-0 flex-col items-center overflow-visible px-1.5 pb-2 pt-1.5',
    className.trim() || 'drop-shadow-[0_3px_12px_rgba(0,0,0,0.16)]',
    opacityClass,
  ]
    .filter(Boolean)
    .join(' ')

  const useSlotCap = Boolean(tightSlot && typeof maxOuterHeightPx === 'number' && maxOuterHeightPx > 0)
  /** 슬롯 안에 맞추는 축소만 담당 — 잔액 성장은 `creditsVisualMul` 을 곱해 별도로 적용합니다 */
  const slotScale = useSlotCap ? Math.min(1, maxOuterHeightPx! / displayHeight) : 1
  /** 인덱스 9 = `home_credit10` — 마지막 단계만 시각적으로 축소 */
  const lastCoinStageMul = displayStage === COIN_STAGE_COUNT - 1 ? FLOATING_LAST_COIN_STAGE_VISUAL_MUL : 1
  const finalVisualScale = slotScale * creditsVisualMul * lastCoinStageMul

  /**
   * `translateY(0)` 로 하단 클립을 막은 뒤에도, PNG·서브픽셀 여유를 위해 `overflow-visible` 을 둡니다.
   * (슬롯 바깥은 `useSlotCap` 쪽 flex 의 `overflow-hidden` 이 한 번 더 막습니다.)
   */
  const stageBox = (
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
  )

  return (
    <div
      className={outerShellClass}
      style={useSlotCap ? { height: maxOuterHeightPx, width: '100%', maxWidth: '100%' } : undefined}
      aria-hidden
    >
      {useSlotCap ? (
        <div className="flex h-full min-h-0 w-full items-end justify-center overflow-visible">
          <div
            className="shrink-0"
            style={{
              width: layoutWidth,
              height: displayHeight,
              transform: `scale(${finalVisualScale})`,
              transformOrigin: 'bottom center',
            }}
          >
            {stageBox}
          </div>
        </div>
      ) : (
        <div
          className="inline-flex max-w-none shrink-0"
          style={{
            transform: `scale(${creditsVisualMul * lastCoinStageMul})`,
            transformOrigin: 'bottom center',
          }}
        >
          {stageBox}
        </div>
      )}
    </div>
  )
}
