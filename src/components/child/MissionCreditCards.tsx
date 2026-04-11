'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import PiggyBankStageVisual from '@/components/child/PiggyBankStageVisual'
import FloatingCreditsStackVisual from '@/components/child/FloatingCreditsStackVisual'
import { walletImageSrcByCredits } from '@/lib/walletStages'
import { MISSION_CREDITS_STAGE_CAP, piggyBankStageCount } from '@/constants/piggyBankStages'

/* ─────────────── Slot number (릴 효과) ─────────────── */

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
    <span className={`inline-flex items-center gap-[0.04em] font-black tabular-nums ${toneClass} ${sizeClass}`}>
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

/* ─────────────── Props ─────────────── */

export interface MissionCreditCardsProps {
  piggy: number
  floating: number
  wallet: number
  onPiggyTap: () => void
  onCenterTap: () => void
  onWalletTap: () => void
}

/* ─────────────── 메인 컴포넌트 ─────────────── */

export default function MissionCreditCards({
  piggy,
  floating,
  wallet,
  onPiggyTap,
  onCenterTap,
  onWalletTap,
}: MissionCreditCardsProps) {
  const piggyStep = piggyStepFromCredits(piggy)

  return (
    <div className="px-3 pt-4 pb-2" aria-label="크레딧 현황">
      <div className="grid grid-cols-3 gap-2">

        {/* ── 저금통 ── */}
        <button
          type="button"
          onClick={onPiggyTap}
          className="flex flex-col items-center gap-1 rounded-2xl bg-rose-50 px-1.5 py-3 text-center shadow-sm ring-1 ring-rose-200/60 transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
        >
          <div className="flex h-[72px] w-full items-end justify-center overflow-visible">
            <PiggyBankStageVisual
              stepIndex={piggyStep}
              displayWidth={60}
              className="select-none"
            />
          </div>
          <SlotNumber value={piggy} toneClass="text-rose-700" sizeClass="text-lg" />
          <p className="text-[11px] font-black text-rose-800">저금통</p>
          <p className="text-[9.5px] leading-tight text-rose-500">크레딧 모이는 중</p>
          <span className="mt-0.5 rounded-full bg-rose-200/70 px-2 py-0.5 text-[9px] font-bold text-rose-700">
            이자 붙는 중 ✅
          </span>
        </button>

        {/* ── 가용 크레딧 ── */}
        <button
          type="button"
          disabled={floating <= 0}
          onClick={onCenterTap}
          className={[
            'flex flex-col items-center gap-1 rounded-2xl bg-amber-50 px-1.5 py-3 text-center shadow-sm ring-1 ring-amber-200/60 transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300',
            floating <= 0 ? 'opacity-50' : '',
          ].join(' ')}
        >
          <div className="flex h-[72px] w-full items-end justify-center overflow-visible">
            <FloatingCreditsStackVisual
              floating={floating}
              dimWhenEmpty={false}
              centerInFrame
              displayWidth={60}
              className="select-none"
            />
          </div>
          <SlotNumber value={floating} toneClass="text-amber-700" sizeClass="text-lg" />
          <p className="text-[11px] font-black text-amber-800">가용 크레딧</p>
          <p className="text-[9.5px] leading-tight text-amber-500">미션 완료로 쌓여요</p>
          <span className="mt-0.5 rounded-full bg-amber-200/70 px-2 py-0.5 text-[9px] font-bold text-amber-700">
            {floating > 0 ? '눌러서 나누기 →' : '아직 없어요'}
          </span>
        </button>

        {/* ── 내 지갑 ── */}
        <button
          type="button"
          onClick={onWalletTap}
          className="flex flex-col items-center gap-1 rounded-2xl bg-teal-50 px-1.5 py-3 text-center shadow-sm ring-1 ring-teal-200/60 transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
        >
          <div className="flex h-[72px] w-full items-end justify-center overflow-visible">
            <Image
              src={walletImageSrcByCredits(wallet)}
              alt=""
              width={64}
              height={64}
              className="select-none object-contain"
              draggable={false}
            />
          </div>
          <SlotNumber value={wallet} toneClass="text-teal-700" sizeClass="text-lg" />
          <p className="text-[11px] font-black text-teal-800">내 지갑</p>
          <p className="text-[9.5px] leading-tight text-teal-500">쓸 수 있는 크레딧</p>
          <span className="mt-0.5 rounded-full bg-teal-200/70 px-2 py-0.5 text-[9px] font-bold text-teal-700">
            지금 사용 가능 ✦
          </span>
        </button>

      </div>
    </div>
  )
}
