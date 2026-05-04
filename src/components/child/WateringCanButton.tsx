'use client'

/**
 * 물주기(하트 1 소모) 버튼입니다.
 *
 * 비개발자 설명:
 * - 탭하면 보유 하트 1개를 써서 화분 진행도를 올립니다.
 * - 위에는 **하트 + 숫자** 한 줄 — 레벨 카드 크레딧 줄과 같이 **왼쪽 정렬·간격**, 숫자는 같은 크기·색, 하트는 미션과 같은 `icons.png` 하트 스프라이트.
 * - 아래에 **물조리개 그림**을 둡니다.
 * - 하트 구간에 따라 물조리개 PNG 가 바뀝니다(100 / 200 / 300).
 */

import { useState } from 'react'
import Image from 'next/image'
import SpriteImage from '@/components/common/SpriteImage'
import { ICONS } from '@/constants/sprites'
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
  /** false면 상단 하트·숫자 줄을 숨깁니다. */
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
            ? 'flex w-full max-w-full flex-col items-stretch gap-3 overflow-visible border-0 bg-transparent p-0 transition-transform active:scale-90 disabled:opacity-50'
            : 'flex h-14 w-14 shrink-0 items-center justify-center border-0 bg-transparent p-0 transition-transform active:scale-90 disabled:opacity-50'
        }
        aria-label={`물 주기 — 보유 하트 ${hearts}개`}
      >
        {/*
          비개발자: ChildLevelStatsCard 크레딧 줄과 동일하게 왼쪽부터(justify-start) 아이콘 18 + 숫자.
          하트 그림은 MissionProgressHeartsRow 와 같은 스프라이트(채워진 하트 색).
          aria-hidden: 버튼 aria-label 로 개수를 이미 읽어 줍니다.
        */}
        {showHeartRow ? (
          <div className="flex w-full min-w-0 max-w-full items-center gap-1.5" aria-hidden>
            <span className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center">
              <SpriteImage
                sheet={ICONS}
                frame="heart"
                width={18}
                clipRotated={false}
                className="h-[18px] w-[18px] shrink-0 select-none object-contain"
              />
            </span>
            <span
              className="min-w-0 shrink-0 truncate font-black tabular-nums leading-none"
              style={{
                fontSize: 20,
                color: '#7A4F00',
                letterSpacing: '-0.5px',
              }}
            >
              {hearts}
            </span>
          </div>
        ) : null}

        {/*
          비개발자: 하트 줄 아래 물조리개 — gap·translate-y 로 위치, 아주 약간만 오른쪽(-translate-x-1).
          크기는 32px 정사각으로 예전(28)보다 살짝만 키웠습니다.
        */}
        <div className="relative shrink-0 self-center -translate-x-1 translate-y-1 overflow-visible" style={{ width: 32, height: 32 }}>
          <div
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              animation: pouring ? 'canTilt 0.5s ease-in-out' : undefined,
            }}
          >
            <Image src={canImg} alt="물조리개" fill className="object-contain" sizes="32px" priority />
          </div>
          {drops ? [0, 1, 2].map((i) => <WaterDrop key={i} index={i} />) : null}
        </div>
      </button>
    </>
  )
}
