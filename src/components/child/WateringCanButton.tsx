'use client'

/**
 * 물주기(하트 1 소모) 버튼입니다.
 *
 * 비개발자 설명:
 * - 탭하면 보유 하트 1개를 써서 화분 진행도를 올립니다.
 * - 하트·숫자는 물조리개 **오른쪽 옆**에만 두고, 둥근 배경·테두리 같은 **감싼 블록은 쓰지 않습니다**(하트 → 숫자 순, 살짝 아래 정렬).
 * - 하트 구간에 따라 물조리개 PNG 가 바뀝니다(100 / 200 / 300).
 */

import { useState } from 'react'
import Image from 'next/image'
import { getWateringCanImage } from '@/constants/plantTrees'
import type { WaterResult } from '@/hooks/usePlantPot'

type Props = {
  hearts: number
  disabled?: boolean
  onWater: () => Promise<WaterResult>
  /** 하트 0개일 때 — 바깥에서 말풍선 등 표시 */
  onNoHearts: () => void
  /** 7단계 완성 직후 */
  onCompleted: () => void
  /** 단계가 한 칸 올라갔을 때(선택) */
  onLevelUp?: () => void
  /** false면 오른쪽 옆 하트·숫자 표시를 숨깁니다. */
  showHeartRow?: boolean
}

function WaterDrop({ index }: { index: number }) {
  const x = -8 + index * 8
  const delay = index * 0.08
  return (
    <div
      style={{
        position: 'absolute',
        bottom: -4,
        left: `calc(50% + ${x}px)`,
        fontSize: 12,
        animation: 'dropFall 0.55s ease-in forwards',
        animationDelay: `${delay}s`,
        pointerEvents: 'none',
      }}
    >
      💧
    </div>
  )
}

export default function WateringCanButton({
  hearts,
  disabled,
  onWater,
  onNoHearts,
  onCompleted,
  onLevelUp,
  showHeartRow = true,
}: Props) {
  const [pouring, setPouring] = useState(false)
  const [drops, setDrops] = useState(false)
  const canImg = getWateringCanImage(hearts)

  async function handleClick() {
    if (pouring || disabled) return
    setPouring(true)
    setDrops(true)
    window.setTimeout(() => setDrops(false), 700)
    try {
      const result = await onWater()
      if (result === 'no_hearts') onNoHearts()
      else if (result === 'completed') onCompleted()
      else if (result === 'leveled_up') onLevelUp?.()
    } finally {
      window.setTimeout(() => setPouring(false), 500)
    }
  }

  return (
    <>
      <style>{`
        @keyframes dropFall {
          0% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          80% {
            transform: translateY(16px) scale(0.8);
            opacity: 0.8;
          }
          100% {
            transform: translateY(22px) scale(0.5);
            opacity: 0;
          }
        }
        @keyframes canTilt {
          0% {
            transform: rotate(0deg);
          }
          30% {
            transform: rotate(-25deg) translateX(-4px);
          }
          70% {
            transform: rotate(-20deg) translateX(-4px);
          }
          100% {
            transform: rotate(0deg);
          }
        }
      `}</style>

      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || pouring}
        className={
          showHeartRow
            ? 'relative inline-flex overflow-visible border-0 bg-transparent p-0 pt-0 pr-0 pl-0 transition-transform active:scale-90 disabled:opacity-50'
            : 'flex h-14 w-14 shrink-0 items-center justify-center border-0 bg-transparent p-0 transition-transform active:scale-90 disabled:opacity-50'
        }
        aria-label={`물 주기 — 보유 하트 ${hearts}개`}
      >
        {/* 비개발자: 조리개 그림 + 오른쪽에 하트·숫자만(배경 박스 없음, 세로는 조리개 중심보다 살짝 아래) */}
        <div className="relative shrink-0 overflow-visible" style={{ width: 28, height: 28 }}>
          <div
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              animation: pouring ? 'canTilt 0.5s ease-in-out' : undefined,
            }}
          >
            <Image src={canImg} alt="물조리개" fill className="object-contain" sizes="28px" priority />
          </div>
          {drops ? [0, 1, 2].map((i) => <WaterDrop key={i} index={i} />) : null}

          {showHeartRow ? (
            <div
              className="pointer-events-none absolute top-1/2 left-full z-10 ml-0.5 flex -translate-y-1/2 translate-y-1.5 items-center gap-px drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
              aria-hidden
            >
              <span className="text-[9px] leading-none">❤️</span>
              <span className="-ml-px text-[9px] font-black leading-none tabular-nums text-pink-500">{hearts}</span>
            </div>
          ) : null}
        </div>
      </button>
    </>
  )
}
