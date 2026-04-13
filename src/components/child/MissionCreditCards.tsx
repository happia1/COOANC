'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Image from 'next/image'
import PiggyBankStageVisual from '@/components/child/PiggyBankStageVisual'
import FloatingCreditsStackVisual from '@/components/child/FloatingCreditsStackVisual'
import { walletImageSrcByStage, walletStageIndexByCredits } from '@/lib/walletStages'
import { MISSION_CREDITS_STAGE_CAP, piggyBankStageCount } from '@/constants/piggyBankStages'

/* ─────────────── 슬롯 숫자 (릴 효과) ─────────────── */

function SlotDigit({ digit, sizeClass }: { digit: string; sizeClass: string }) {
  if (digit === ',') {
    return (
      <span className={`inline-flex h-[1.15em] items-center justify-center ${sizeClass} leading-none`}>,</span>
    )
  }
  const n = Number(digit)
  return (
    <span className={`relative inline-flex h-[1.15em] w-[0.78em] overflow-hidden ${sizeClass} leading-none`}>
      <span
        className="absolute left-0 top-0 flex flex-col transition-transform duration-200 ease-out"
        style={{ transform: `translateY(-${n * 1.15}em)` }}
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={`s${i}`} className="h-[1.15em] leading-[1.15em]">{i}</span>
        ))}
      </span>
    </span>
  )
}

function SlotNumber({ value, toneClass, sizeClass }: { value: number; toneClass: string; sizeClass: string }) {
  const target = Math.max(0, Math.floor(value))
  const [displayed, setDisplayed] = useState(target)

  useEffect(() => {
    if (displayed === target) return
    const tick = setInterval(() => {
      setDisplayed((prev) => {
        if (prev === target) return prev
        const diff = target - prev
        const step = Math.max(1, Math.floor(Math.abs(diff) / 8))
        return prev + Math.sign(diff) * step
      })
    }, 45)
    return () => clearInterval(tick)
  }, [target, displayed])

  const chars = useMemo(() => String(displayed).split(''), [displayed])

  return (
    <span className={`inline-flex items-center gap-[0.04em] font-semibold tabular-nums ${toneClass} ${sizeClass}`}>
      {chars.map((ch, idx) => (
        <span
          key={`d-${idx}-${ch}`}
          className="inline-flex min-w-[0.9em] items-center justify-center rounded-[0.22em] border border-white/90 bg-white/95 px-[0.14em] py-[0.06em] shadow-[0_1px_2px_rgba(15,23,42,0.18)]"
        >
          <SlotDigit digit={ch} sizeClass={sizeClass} />
        </span>
      ))}
    </span>
  )
}

/* ─────────────── 저금통 단계 계산 ─────────────── */

function piggyStepFromCredits(piggy: number): number {
  const n = piggyBankStageCount()
  if (n <= 1) return 0
  const t = Math.max(1, MISSION_CREDITS_STAGE_CAP)
  const ratio = Math.max(0, Math.min(piggy, t)) / t
  return Math.round(ratio * (n - 1))
}

/**
 * 저금통 **그림 단계**(`animatedPiggyStep`)와 같은 속도로 잔액을 “따라가게” 만든 값입니다.
 * (비개발자용) 돈바구니에서 1000을 한 번에 넣으면 DB 숫자는 바로 1000이지만, 단계는 0→1→…→13처럼 천천히 바뀝니다.
 * `PiggyBankStageVisual` 에는 예전처럼 바로 1000을 넘기면 **크기만** 벌써 최대로 커져 버려서, 단계에 맞춘 가짜 잔액으로 크기도 같이 커지게 합니다.
 */
function piggyCreditsForProgressiveWhileStepAnimates(
  actualPiggy: number,
  animatedStep: number,
  targetStep: number,
  stageCount: number,
): number {
  if (stageCount <= 1) return actualPiggy
  /** 단계 애니메이션이 끝나면 반드시 실제 잔액(999 vs 1000 등 미세 차이)을 씁니다 */
  if (animatedStep === targetStep) return actualPiggy
  const cap = MISSION_CREDITS_STAGE_CAP
  const raw = Math.round((animatedStep / Math.max(1, stageCount - 1)) * cap)
  return Math.max(0, Math.min(cap, raw))
}

/* ─────────────── 공통 이미지 박스 크기 ─────────────── */

/** 세 칸(저금통·돈바구니·지갑) 아이콘 정사각 한 변 — 저금통·지갑 원래 크기(60). */
const IMG_BOX = 60 as const

/** 아이콘은 박스보다 조금 작게 그려 여백을 둡니다. */
const ICON_DISPLAY = IMG_BOX - 8

/**
 * 돈바구니(가용 크레딧) — `FloatingCreditsStackVisual` 의 `displayWidth` (원래 비율: 지갑·저금통과 맞춘 1.9배).
 */
const FLOATING_COIN_DISPLAY_WIDTH = Math.round(ICON_DISPLAY * 1.9)

/**
 * 세 칸 공통 아이콘 행 높이(레이아웃) — 카드 전체 높이를 올리지 않기 위해 예전처럼 `IMG_BOX + 32` 유지.
 * (비개발자용) 돈바구니만 **절반 높이**로 그린 다음 `FLOATING_MONEY_VISUAL_SCALE` 으로 키워, **줄 높이**는 옆 칸과 같습니다.
 */
const FLOATING_ICON_BOX = IMG_BOX + 32

/**
 * 돈바구니 `tightSlot` 용 세로 한도 — `FLOATING_ICON_BOX` 의 절반.
 * 바깥 `FLOATING_MONEY_VISUAL_SCALE` 과 곱해져 화면에 보이는 동전·바구니 크기가 정해집니다.
 */
const FLOATING_TIGHT_SLOT_HEIGHT_PX = Math.max(28, Math.floor(FLOATING_ICON_BOX / 2))

/**
 * 돈바구니 그림만 키우는 배율 — 저금통·지갑·글·숫자는 그대로 두고 이 값만 조정하면 됩니다.
 * (비개발자용) `2` 보다 크면 돈바구니 그림만 더 커 보이고, 옆 칸과 겹치지 않게 가로는 잘립니다.
 */
const FLOATING_MONEY_VISUAL_SCALE = 2.45

/**
 * 세 칸 **제목** 줄 맞춤용 아이콘 행 — `justify-end` 로 그림을 아래에 붙입니다.
 * (비개발자용) `overflow-x-hidden` + `overflow-y-visible` 을 같이 쓰면 브라우저가 세로를 `auto`로 바꿔
 * **세로 스크롤바**가 생길 수 있어(저금통 옆 슬라이드), 여기서는 `overflow-visible` 만 씁니다.
 */
const CREDIT_ICON_ROW_CLASS =
  'flex w-full shrink-0 flex-col items-center justify-end overflow-visible'

/** 돈바구니 아이콘 행 — 스크롤 방지를 위해 `overflow` 는 전부 보이게 둡니다. */
const CREDIT_ICON_ROW_FLOATING_CLASS =
  'relative flex w-full shrink-0 flex-col items-center justify-end overflow-visible'

/**
 * 카드 테두리·패딩(`creditCardShell`)은 그대로 두고, 안의 그림+제목+숫자+설명 묶음만 위로 올립니다.
 * (비개발자용) `transform` 이라 카드 박스 크기 숫자는 그대로이고, 눈에 보이는 내용만 위로 붙습니다.
 */
const CREDIT_CARD_INNER_LIFT_CLASS = '-translate-y-2.5'

/** 미션 카드 저금통 일러스트만 살짝 아래로 내립니다(돈바구니·지갑은 그대로). */
const PIGGY_CREDIT_CARD_NUDGE_DOWN_CLASS = 'translate-y-1.5'

/** 내 지갑 일러스트만 살짝 위로 올립니다(카드 박스·숫자 줄 위치는 `CREDIT_CARD_INNER_LIFT` 와 동일). */
const WALLET_CREDIT_CARD_NUDGE_UP_CLASS = '-translate-y-1'

/* ─────────────── Props ─────────────── */

export interface MissionCreditCardsProps {
  piggy: number
  floating: number
  wallet: number
  onPiggyTap: () => void
  onCenterTap: () => void
  onWalletTap: () => void
}

export default function MissionCreditCards({
  piggy,
  floating,
  wallet,
  onPiggyTap,
  onCenterTap,
  onWalletTap,
}: MissionCreditCardsProps) {
  /** 실제 크레딧이 바뀔 때 저금통·지갑 그림이 **한 단계씩** 따라가게(미션 섬 `ChildHomeIslandStage` 와 같은 방식) */
  const piggyTarget = useMemo(() => piggyStepFromCredits(piggy), [piggy])
  const [animatedPiggyStep, setAnimatedPiggyStep] = useState(piggyTarget)
  const animatedPiggyRef = useRef(animatedPiggyStep)
  useEffect(() => {
    animatedPiggyRef.current = animatedPiggyStep
  }, [animatedPiggyStep])

  useEffect(() => {
    if (piggyTarget === animatedPiggyRef.current) return
    const tick = setInterval(() => {
      setAnimatedPiggyStep((prev) => {
        if (prev === piggyTarget) return prev
        return prev + (piggyTarget > prev ? 1 : -1)
      })
    }, 170)
    return () => clearInterval(tick)
  }, [piggyTarget])

  /** `PiggyBankStageVisual` 의 850+ 시각 스케일·800대 축소에 넣는 “화면용 잔액” — 단계와 동시에 움직임 */
  const piggyStageCount = useMemo(() => piggyBankStageCount(), [])
  const piggyCreditsForVisual = useMemo(
    () =>
      piggyCreditsForProgressiveWhileStepAnimates(piggy, animatedPiggyStep, piggyTarget, piggyStageCount),
    [piggy, animatedPiggyStep, piggyTarget, piggyStageCount],
  )

  const walletTarget = useMemo(() => walletStageIndexByCredits(wallet), [wallet])
  const [animatedWalletStage, setAnimatedWalletStage] = useState(walletTarget)
  const animatedWalletRef = useRef(animatedWalletStage)
  useEffect(() => {
    animatedWalletRef.current = animatedWalletStage
  }, [animatedWalletStage])

  useEffect(() => {
    if (walletTarget === animatedWalletRef.current) return
    const tick = setInterval(() => {
      setAnimatedWalletStage((prev) => {
        if (prev === walletTarget) return prev
        return prev + (walletTarget > prev ? 1 : -1)
      })
    }, 160)
    return () => clearInterval(tick)
  }, [walletTarget])

  /**
   * 카드 바깥 테두리·배경
   * (비개발자용) 맨 위 안쪽 여백을 거의 없앰(`pt-0`), 아래는 `pb-2` 유지로 카드 세로를 더 줄입니다.
   */
  const creditCardShell =
    'rounded-xl bg-white/78 px-1.5 pt-0 pb-2 shadow-sm ring-1 ring-white/75 backdrop-blur-[2px] transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90'

  return (
    <div
      className="mx-auto grid w-full max-w-[16.75rem] grid-cols-3 gap-2 overflow-visible sm:max-w-[17.25rem]"
      aria-label="크레딧 현황"
    >

      {/* ── 저금통 ── */}
      <button
        type="button"
        onClick={onPiggyTap}
        className={`flex flex-col items-center overflow-visible ${creditCardShell}`}
      >
        <div
          className={`flex w-full min-w-0 flex-col items-center gap-0.5 ${CREDIT_CARD_INNER_LIFT_CLASS}`}
        >
          <div className={CREDIT_ICON_ROW_CLASS} style={{ height: FLOATING_ICON_BOX, minHeight: FLOATING_ICON_BOX }}>
            {/**
             * 고정 `height: 60` + (잘못된 조합의) `overflow-x-hidden` 은 브라우저가 세로 `overflow` 를 `auto` 로 바꿔
             * **스크롤바**가 생길 수 있습니다. 높이는 `minHeight` 만 두고 그림은 `overflow-visible` 로 잘리지 않게 합니다.
             */}
            <div
              className={`flex max-w-full shrink-0 flex-col items-center justify-end overflow-visible ${PIGGY_CREDIT_CARD_NUDGE_DOWN_CLASS}`}
              style={{ width: IMG_BOX, minHeight: IMG_BOX }}
            >
              <PiggyBankStageVisual
                stepIndex={animatedPiggyStep}
                displayWidth={ICON_DISPLAY}
                piggyCredits={piggyCreditsForVisual}
                className="select-none"
              />
            </div>
          </div>
          <p className="text-[10px] font-bold text-rose-800">저금통</p>
          <SlotNumber value={piggy} toneClass="text-rose-700" sizeClass="text-sm" />
          <p className="text-center text-[10px] font-medium leading-tight text-rose-800">저축을 해요</p>
        </div>
      </button>

      {/* ── 돈바구니(가용 크레딧) ── */}
      <button
        type="button"
        disabled={floating <= 0}
        onClick={onCenterTap}
        className={[
          `flex flex-col items-center overflow-visible ${creditCardShell}`,
          floating <= 0 ? 'opacity-50' : '',
        ].join(' ')}
      >
        <div
          className={`flex w-full min-w-0 flex-col items-center gap-0.5 ${CREDIT_CARD_INNER_LIFT_CLASS}`}
        >
          <div
            className={CREDIT_ICON_ROW_FLOATING_CLASS}
            style={{ height: FLOATING_ICON_BOX, minHeight: FLOATING_ICON_BOX }}
          >
            {/**
             * 카드 줄 높이는 `FLOATING_ICON_BOX` 로 저금통·지갑과 동일.
             * 돈바구니만 `maxOuterHeightPx` 를 **절반**으로 두고 `FLOATING_MONEY_VISUAL_SCALE` + `origin-bottom` 으로
             * 그림만 키우고, 레이아웃(카드 높이·저금통·지갑·글)은 건드리지 않음.
             */}
            {/**
             * `translate` + `scale` 을 한 줄에만 써야 브라우저가 덮어쓰지 않습니다. 위로 살짝 올리는 값은 예전 `translate-y-1` 정도.
             */}
            <div
              className="pointer-events-none absolute bottom-0 left-1/2 z-[1] flex items-end justify-center"
              style={{
                transform: `translate(-50%, -0.25rem) scale(${FLOATING_MONEY_VISUAL_SCALE})`,
                transformOrigin: 'bottom center',
              }}
            >
              <FloatingCreditsStackVisual
                floating={floating}
                dimWhenEmpty={false}
                tightSlot
                maxOuterHeightPx={FLOATING_TIGHT_SLOT_HEIGHT_PX}
                displayWidth={FLOATING_COIN_DISPLAY_WIDTH}
                className="select-none"
              />
            </div>
          </div>
          <p className="text-[10px] font-bold text-amber-800">돈바구니</p>
          <SlotNumber value={floating} toneClass="text-amber-700" sizeClass="text-sm" />
          <p className="text-center text-[10px] font-medium leading-tight text-amber-900">보상을 받아요</p>
        </div>
      </button>

      {/* ── 내 지갑 ── */}
      <button
        type="button"
        onClick={onWalletTap}
        className={`flex flex-col items-center overflow-visible ${creditCardShell}`}
      >
        <div
          className={`flex w-full min-w-0 flex-col items-center gap-0.5 ${CREDIT_CARD_INNER_LIFT_CLASS}`}
        >
          <div className={CREDIT_ICON_ROW_CLASS} style={{ height: FLOATING_ICON_BOX, minHeight: FLOATING_ICON_BOX }}>
            <div
              className={`flex max-w-full shrink-0 flex-col items-center justify-end overflow-visible ${WALLET_CREDIT_CARD_NUDGE_UP_CLASS}`}
              style={{ width: IMG_BOX, minHeight: IMG_BOX }}
            >
              <Image
                src={walletImageSrcByStage(animatedWalletStage)}
                alt=""
                width={ICON_DISPLAY}
                height={ICON_DISPLAY}
                className="select-none object-contain"
                draggable={false}
              />
            </div>
          </div>
          <p className="text-[10px] font-bold text-teal-800">내 지갑</p>
          <SlotNumber value={wallet} toneClass="text-teal-700" sizeClass="text-sm" />
          <p className="text-center text-[10px] font-medium leading-tight text-teal-900">쓸 수 있어요</p>
        </div>
      </button>

    </div>
  )
}
