'use client'

/**
 * 자녀 홈 상단 왼쪽 — 레벨·경험치·크레딧·(선택)보유 하트를 **한 장의 유리 카드** 안에 묶습니다.
 *
 * 비개발자 설명:
 * - 식물 물주기용 **하트 개수**는 크레딧 줄 **바로 아래**에 같은 스타일로 넣을 수 있어요.
 */

import SpriteImage from '@/components/common/SpriteImage'
import { ICONS } from '@/constants/sprites'
import type { ChildStats } from '@/types/database'
import { CHILD_HOME_TOP_BAR_GLASS_CLASS, CHILD_HOME_TOP_BAR_GLASS_STYLE } from '@/lib/childHomeTopBarGlass'

interface ChildLevelStatsCardProps {
  stats: Pick<ChildStats, 'current_level' | 'exp' | 'exp_to_next_level' | 'credits'>
  creditRef?: React.RefObject<HTMLDivElement | null>
  /** 하트 파티클 도착 좌표 계산용 ref (크레딧 아래 하트 줄) */
  heartRef?: React.RefObject<HTMLDivElement | null>
  shine?: boolean
  className?: string
  /** 물주기에 쓸 보유 하트 — 넣으면 크레딧 아래에 아이콘+숫자 한 줄이 더 붙습니다. */
  heartsCount?: number
}

function formatCredits(value: number): string {
  if (value >= 10_000) return `${(value / 10_000).toFixed(1).replace(/\.0$/, '')}만`
  return value.toLocaleString('ko-KR')
}

export default function ChildLevelStatsCard({
  stats,
  creditRef,
  heartRef,
  shine = false,
  className = '',
  heartsCount,
}: ChildLevelStatsCardProps) {
  const { current_level, exp, exp_to_next_level, credits } = stats

  const progressPct =
    !exp_to_next_level || exp_to_next_level <= 0 ? 100 : Math.min(100, Math.round((exp / exp_to_next_level) * 100))

  const totalCredits = credits ?? 0

  return (
    <>
      <style>{`
        @keyframes creditShine {
          0%   { transform: scale(1);    color: #4A3520; }
          30%  { transform: scale(1.18); color: #C47F00; filter: drop-shadow(0 0 6px #FFD700); }
          100% { transform: scale(1);    color: #4A3520; }
        }
      `}</style>
      <div
        className={[
          CHILD_HOME_TOP_BAR_GLASS_CLASS,
          'pointer-events-none max-w-full min-w-0 w-fit px-3 pt-2.5 pb-2.5',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        style={CHILD_HOME_TOP_BAR_GLASS_STYLE}
        role="region"
        aria-label={
          typeof heartsCount === 'number'
            ? `레벨 ${current_level}, 크레딧 ${totalCredits.toLocaleString('ko-KR')}, 보유 하트 ${heartsCount}`
            : `레벨 ${current_level}, 크레딧 ${totalCredits.toLocaleString('ko-KR')}`
        }
      >
        <div className="mb-1 flex w-full items-baseline justify-between gap-2">
          <span
            className="shrink-0 text-[15px] font-black leading-none tracking-wide whitespace-nowrap"
            style={{ color: '#5A3E28' }}
          >
            Lv.{current_level}
          </span>
          <span
            className="min-w-0 text-right text-[10px] font-semibold leading-none tabular-nums whitespace-nowrap"
            style={{ color: '#9A7A5A' }}
          >
            {exp}/{exp_to_next_level}
          </span>
        </div>

        <div
          className="mb-2 h-[5px] w-full overflow-hidden rounded-full"
          style={{ background: 'rgba(255,255,255,0.5)' }}
          role="progressbar"
          aria-valuenow={exp}
          aria-valuemin={0}
          aria-valuemax={exp_to_next_level}
        >
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, #FF8C00 0%, #FFD700 100%)',
              boxShadow: '0 1px 4px rgba(255,140,0,0.5)',
            }}
          />
        </div>

        <div className="mb-2 h-px w-full" style={{ background: 'rgba(255,255,255,0.5)' }} />

        <div ref={creditRef} className="flex min-w-0 max-w-full items-center gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/assets/img/common/ui/${encodeURIComponent('크레딧.png')}`}
            alt=""
            width={18}
            height={18}
            className="h-[18px] w-[18px] shrink-0 object-contain select-none"
            draggable={false}
          />
          <span
            className="min-w-0 flex-1 truncate font-black tabular-nums leading-none"
            style={{
              fontSize: 20,
              color: '#7A4F00',
              animation: shine ? 'creditShine 0.6s ease-out' : undefined,
              letterSpacing: '-0.5px',
            }}
          >
            {formatCredits(totalCredits)}
          </span>
        </div>

        {typeof heartsCount === 'number' ? (
          <>
            <div className="mt-2 h-px w-full" style={{ background: 'rgba(255,255,255,0.5)' }} />
            <div ref={heartRef} className="mt-2 flex min-w-0 max-w-full items-center gap-1.5">
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
                {heartsCount}
              </span>
            </div>
          </>
        ) : null}
      </div>
    </>
  )
}
