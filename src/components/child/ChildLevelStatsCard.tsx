'use client'

/**
 * 자녀 홈 상단 왼쪽 — 레벨·경험치·크레딧·(선택)보유 하트를 **한 장의 유리 카드** 안에 묶습니다.
 *
 * 비개발자 설명:
 * - 식물 물주기용 **하트 개수**는 크레딧 줄 **바로 아래**에 같은 스타일로 넣을 수 있어요.
 * - `onRefresh` 를 넘기면 카드 **오른쪽 아래 모서리**에 작은 회색 새로고침만 붙습니다(유리 버튼 박스 없음).
 */

import SpriteImage from '@/components/common/SpriteImage'
import SlotCounter, {
  CHILD_HOME_CREDIT_SLOT_TIMING,
  CHILD_HOME_HEART_SLOT_TIMING,
} from '@/components/common/SlotCounter'
import { ICONS } from '@/constants/sprites'
import type { ChildStats } from '@/types/database'
import { CHILD_HOME_TOP_BAR_GLASS_CLASS, CHILD_HOME_TOP_BAR_GLASS_STYLE } from '@/lib/childHomeTopBarGlass'
import { CHILD_CREDIT_COIN_PNG_SRC, formatChildCreditsDisplay } from '@/lib/childCreditDisplay'

interface ChildLevelStatsCardProps {
  stats: Pick<ChildStats, 'current_level' | 'exp' | 'exp_to_next_level' | 'credits'>
  creditRef?: React.RefObject<HTMLDivElement | null>
  /** 하트 파티클 도착 좌표 계산용 ref (크레딧 아래 하트 줄) */
  heartRef?: React.RefObject<HTMLDivElement | null>
  shine?: boolean
  className?: string
  /** 물주기에 쓸 보유 하트 — 넣으면 크레딧 아래에 아이콘+숫자 한 줄이 더 붙습니다. */
  heartsCount?: number
  /**
   * 전체 화면 새로고침(예: `location.reload`) — 넘기면 카드 오른쪽 아래에만 작은 회색 아이콘을 그립니다.
   * 별도 유리 버튼 블록은 두지 않습니다.
   */
  onRefresh?: () => void
}

function formatCredits(value: number): string {
  return formatChildCreditsDisplay(value)
}

export default function ChildLevelStatsCard({
  stats,
  creditRef,
  heartRef,
  shine = false,
  className = '',
  heartsCount,
  onRefresh,
}: ChildLevelStatsCardProps) {
  const { current_level, exp, exp_to_next_level, credits } = stats

  const progressPct =
    !exp_to_next_level || exp_to_next_level <= 0 ? 100 : Math.min(100, Math.round((exp / exp_to_next_level) * 100))

  const totalCredits = credits ?? 0

  const creditUsesCompactFormat = totalCredits >= 10_000

  return (
    <div
        className={[
          CHILD_HOME_TOP_BAR_GLASS_CLASS,
          'relative pointer-events-none max-w-full min-w-0 w-fit px-3 pt-2.5 pb-2.5',
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
            src={CHILD_CREDIT_COIN_PNG_SRC}
            alt=""
            width={18}
            height={18}
            className="h-[18px] w-[18px] shrink-0 object-contain select-none"
            draggable={false}
          />
          {creditUsesCompactFormat ? (
            <span
              className="min-w-0 flex-1 truncate font-black tabular-nums leading-none"
              style={{
                fontSize: 20,
                color: '#7A4F00',
                letterSpacing: '-0.5px',
                filter: shine ? 'drop-shadow(0 0 5px rgba(255, 215, 0, 0.75))' : undefined,
                transition: 'filter 0.35s ease-out',
              }}
            >
              {formatCredits(totalCredits)}
            </span>
          ) : (
            <SlotCounter
              value={totalCredits}
              timing={CHILD_HOME_CREDIT_SLOT_TIMING}
              className="min-w-0 flex-1 truncate"
              style={{
                fontSize: 20,
                letterSpacing: '-0.5px',
                filter: shine ? 'drop-shadow(0 0 5px rgba(255, 215, 0, 0.75))' : undefined,
                transition: 'filter 0.35s ease-out',
              }}
            />
          )}
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
              <SlotCounter
                value={heartsCount}
                timing={CHILD_HOME_HEART_SLOT_TIMING}
                className="min-w-0 shrink-0 truncate"
                style={{ fontSize: 20, letterSpacing: '-0.5px' }}
              />
            </div>
          </>
        ) : null}

        {/*
          새로고침: 유리 버튼 없이 SVG만 — 기존 우측 아이콘(h-6)의 절반(h-3), 아주 연한 회색(text-gray-300).
          `bottom-2.5` — 직전에 `bottom-1` 으로 올린 것보다, 그때 늘린 하단 여백(0.125rem)을 세 번 더한 만큼 위로 띄웁니다.
          버튼에만 얇은 padding(배경·테두리 없음). 부모 카드는 pointer-events-none 이라 이 버튼만 pointer-events-auto 로 탭을 받습니다.
        */}
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            className="pointer-events-auto absolute bottom-2.5 right-0.5 z-10 border-0 bg-transparent p-1 transition-opacity active:opacity-70"
            aria-label="화면 새로고침"
            title="화면 새로고침"
          >
            <svg
              className="h-3 w-3 shrink-0 text-gray-300"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16h5v5" />
            </svg>
          </button>
        ) : null}
      </div>
  )
}
