'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import PiggyBankStageVisual from '@/components/child/PiggyBankStageVisual'
import FloatingCreditsStackVisual from '@/components/child/FloatingCreditsStackVisual'
import { walletImageSrcByCredits } from '@/lib/walletStages'
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

/** 세 이미지 모두 이 정사각형 안에 들어갑니다(이전보다 살짝 작게 — 돼지 저금통 체감 크기 조정) */
const IMG_BOX = 72 as const

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
  const piggyStep = piggyStepFromCredits(piggy)

  /** 카드 바깥 테두리·배경: 흰색 + 살짝 투명(블록을 한 톤으로 묶음) */
  const creditCardShell =
    'rounded-2xl bg-white/78 px-1.5 py-3 shadow-sm ring-1 ring-white/75 backdrop-blur-[2px] transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90'

  return (
    <div className="grid grid-cols-3 gap-2" aria-label="크레딧 현황">

      {/* ── 저금통 ── */}
      <button type="button" onClick={onPiggyTap} className={`flex flex-col items-center gap-1 ${creditCardShell}`}>
        <div
          className="flex items-center justify-center overflow-hidden"
          style={{ width: IMG_BOX, height: IMG_BOX }}
        >
          <PiggyBankStageVisual
            stepIndex={piggyStep}
            displayWidth={IMG_BOX - 10}
            className="select-none"
          />
        </div>
        <SlotNumber value={piggy} toneClass="text-rose-700" sizeClass="text-base" />
        <p className="text-[11px] font-bold text-rose-800">저금통</p>
        <p className="mt-0.5 text-center text-[10px] font-medium leading-snug text-rose-800">저축을 해요</p>
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
          className="flex items-center justify-center overflow-hidden"
          style={{ width: IMG_BOX, height: IMG_BOX }}
        >
          <FloatingCreditsStackVisual
            floating={floating}
            dimWhenEmpty={false}
            centerInFrame
            displayWidth={IMG_BOX - 16}
            className="select-none"
          />
        </div>
        <SlotNumber value={floating} toneClass="text-amber-700" sizeClass="text-base" />
        <p className="text-[11px] font-bold text-amber-800">돈바구니</p>
        <p className="mt-0.5 text-center text-[10px] font-medium leading-snug text-amber-900">보상을 받아요</p>
      </button>

      {/* ── 내 지갑 ── */}
      <button type="button" onClick={onWalletTap} className={`flex flex-col items-center gap-1 ${creditCardShell}`}>
        <div
          className="flex items-center justify-center overflow-hidden"
          style={{ width: IMG_BOX, height: IMG_BOX }}
        >
          <Image
            src={walletImageSrcByCredits(wallet)}
            alt=""
            width={IMG_BOX - 8}
            height={IMG_BOX - 8}
            className="select-none object-contain"
            draggable={false}
          />
        </div>
        <SlotNumber value={wallet} toneClass="text-teal-700" sizeClass="text-base" />
        <p className="text-[11px] font-bold text-teal-800">내 지갑</p>
        <p className="mt-0.5 text-center text-[10px] font-medium leading-snug text-teal-900">쓸 수 있어요</p>
      </button>

    </div>
  )
}
