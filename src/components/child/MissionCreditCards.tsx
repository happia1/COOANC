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

/* ─────────────── 공통 이미지 박스 크기 ─────────────── */

/** 세 칸(저금통·돈바구니·지갑) 아이콘이 들어가는 정사각형 한 변 — 줄이면 카드 전체가 덜 커 보입니다. */
const IMG_BOX = 60 as const

/** 아이콘은 박스보다 조금 작게 그려 여백을 둡니다. */
const ICON_DISPLAY = IMG_BOX - 8

/**
 * 돈바구니(가용 크레딧) 동전·바구니 PNG 만 더 크게 — `FloatingCreditsStackVisual` 의 `displayWidth`
 * (저금통·지갑은 `ICON_DISPLAY`). 배율만 키우면 `tightSlot` 안에서 `scale` 로 많이 줄어들 수 있으니
 * 아래 `FLOATING_ICON_BOX` 도 같이 키웁니다.
 */
const FLOATING_COIN_DISPLAY_WIDTH = Math.round(ICON_DISPLAY * 1.9)
/** 세 칸 공통 아이콘 행 높이 — 돈바구니 `maxOuterHeightPx` 로 쓰여, 큰 일러스트가 덜 축소되게 합니다. */
const FLOATING_ICON_BOX = IMG_BOX + 48

/**
 * 세 칸 **제목**(저금통·돈바구니·내 지갑)이 같은 높이에서 시작하도록, 아이콘 영역 높이를
 * 가장 큰 돈바구니(`FLOATING_ICON_BOX`)에 맞추고 `justify-end` 로 그림을 아래에 붙입니다.
 */
const CREDIT_ICON_ROW_CLASS =
  'flex w-full shrink-0 min-h-0 flex-col items-center justify-end overflow-hidden'

/** 돈바구니만 — 위로 살짝 올려도 잘리지 않게 `overflow-visible` */
const CREDIT_ICON_ROW_FLOATING_CLASS =
  'flex w-full shrink-0 min-h-0 flex-col items-center justify-end overflow-visible'

/** 동전·바구니 일러스트를 **살짝 위**로(음수 `translate-y` — 아이콘 행이 `overflow-visible`) */
const FLOATING_COIN_NUDGE_UP_CLASS = '-translate-y-1 sm:-translate-y-1.5'

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

  /** 카드 바깥 테두리·배경 */
  const creditCardShell =
    'rounded-xl bg-white/78 px-1.5 py-3 shadow-sm ring-1 ring-white/75 backdrop-blur-[2px] transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90'

  return (
    <div className="mx-auto grid w-full max-w-[16.75rem] grid-cols-3 gap-2 sm:max-w-[17.25rem]" aria-label="크레딧 현황">

      {/* ── 저금통 ── */}
      <button type="button" onClick={onPiggyTap} className={`flex flex-col items-center gap-1 ${creditCardShell}`}>
        <div className={CREDIT_ICON_ROW_CLASS} style={{ height: FLOATING_ICON_BOX, minHeight: FLOATING_ICON_BOX }}>
          <div
            className="flex shrink-0 items-center justify-center overflow-hidden"
            style={{ width: IMG_BOX, height: IMG_BOX }}
          >
            <PiggyBankStageVisual
              stepIndex={animatedPiggyStep}
              displayWidth={ICON_DISPLAY}
              className="select-none"
            />
          </div>
        </div>
        <p className="text-[10px] font-bold text-rose-800">저금통</p>
        <SlotNumber value={piggy} toneClass="text-rose-700" sizeClass="text-sm" />
        <p className="text-center text-[10px] font-medium leading-snug text-rose-800">저축을 해요</p>
      </button>

      {/* ── 돈바구니(가용 크레딧) ── */}
      <button
        type="button"
        disabled={floating <= 0}
        onClick={onCenterTap}
        className={[
          `flex flex-col items-center gap-1 ${creditCardShell}`,
          floating <= 0 ? 'opacity-50' : '',
        ].join(' ')}
      >
        <div
          className={CREDIT_ICON_ROW_FLOATING_CLASS}
          style={{ height: FLOATING_ICON_BOX, minHeight: FLOATING_ICON_BOX }}
        >
          {/**
           * `tightSlot` + `maxOuterHeightPx`: 동전 레이아웃이 카드보다 클 때 아래를 기준으로 축소해 블록 밖으로 나가지 않음.
           * `FLOATING_COIN_NUDGE_UP_CLASS`: 일러스트만 살짝 위로(제목·숫자 줄과의 간격은 `gap-1` 유지).
           */}
          <div className={`flex w-full items-end justify-center ${FLOATING_COIN_NUDGE_UP_CLASS}`}>
            <FloatingCreditsStackVisual
              floating={floating}
              dimWhenEmpty={false}
              tightSlot
              maxOuterHeightPx={FLOATING_ICON_BOX}
              displayWidth={FLOATING_COIN_DISPLAY_WIDTH}
              className="select-none"
            />
          </div>
        </div>
        <p className="text-[10px] font-bold text-amber-800">돈바구니</p>
        <SlotNumber value={floating} toneClass="text-amber-700" sizeClass="text-sm" />
        <p className="text-center text-[10px] font-medium leading-snug text-amber-900">보상을 받아요</p>
      </button>

      {/* ── 내 지갑 ── */}
      <button type="button" onClick={onWalletTap} className={`flex flex-col items-center gap-1 ${creditCardShell}`}>
        <div className={CREDIT_ICON_ROW_CLASS} style={{ height: FLOATING_ICON_BOX, minHeight: FLOATING_ICON_BOX }}>
          <div
            className="flex shrink-0 items-center justify-center overflow-hidden"
            style={{ width: IMG_BOX, height: IMG_BOX }}
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
        <p className="text-center text-[10px] font-medium leading-snug text-teal-900">쓸 수 있어요</p>
      </button>

    </div>
  )
}
