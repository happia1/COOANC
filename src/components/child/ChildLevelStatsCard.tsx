'use client'

/**
 * ChildLevelStatsCard — 자녀 레벨·경험치·하트·크레딧 요약 카드
 *
 * 비개발자 설명:
 * - 아이의 현재 레벨, 경험치 진행도(바 그래프),
 *   오늘 미션 완주율(하트 5개), 보유 총 크레딧을 한눈에 보여주는 블록입니다.
 * - 배경이 반투명하여 뒤쪽 배경 이미지가 살짝 비쳐 보입니다.
 * - 카드 너비를 좁게 유지하여 화면 오른쪽 캐릭터를 가리지 않습니다.
 * - `ref` 는 「Mission Complete」줄의 하트 5칸(미션 달성 막대) — 미션에서 받은 **애정 하트** 파티클이 여기로 날아갑니다.
 * - 미션이 완료되어 막대 하트가 늘어날 때, 새로 켜진 한 칸만 잠깐 `차오름` 애니메이션이 납니다.
 *
 * 구성:
 *   Lv.{n}  {exp}/{exp_to_next}  (DB `current_level`과 동일, 부모 앱과 표기 통일)
 *   ────────────────────────────────
 *   [주황~노란 경험치 진행 바]
 *   ────────────────────────────────
 *   MISSION COMPLETE
 *   ❤️❤️❤️❤️🤍  (오늘 미션 완주율 하트)
 *   ────────────────────────────────
 *   CREDITS
 *   🪙 1,025   ← 코인 파티클이 이 지점으로 날아옵니다
 */

import { useLayoutEffect, useMemo, useRef, useState, forwardRef } from 'react'
import type { ChildStats } from '@/types/database'

// ─── Props ───────────────────────────────────────────────────────────────────
interface ChildLevelStatsCardProps {
  /** 레벨·경험치·크레딧 스탯 */
  stats: Pick<ChildStats, 'current_level' | 'exp' | 'exp_to_next_level' | 'credits'>
  /**
   * 오늘 미션 완주율에 따른 하트 개수 (0~5).
   * ChildScreen 에서 completionRateToHearts() 로 계산한 값을 그대로 전달합니다.
   */
  filledHearts: number
  /**
   * 크레딧 행에 부착할 ref.
   * 미션 완료 파티클(코인)이 이 DOM 요소의 중심으로 날아옵니다.
   * ChildScreen 의 creditBadgeRef 를 그대로 전달하면 됩니다.
   */
  creditRef?: React.RefObject<HTMLDivElement | null>
  /**
   * true 이면 크레딧 숫자가 잠깐 황금빛으로 반짝입니다.
   * 파티클이 도착한 직후 ChildScreen 에서 badgeShine = true 로 설정합니다.
   */
  shine?: boolean
  /** 추가 CSS 클래스 (위치·여백 조정용) */
  className?: string
}

// ─── 숫자 → 한국식 단위 포맷 ─────────────────────────────────────────────────
function formatCredits(value: number): string {
  if (value >= 10_000) {
    return `${(value / 10_000).toFixed(1).replace(/\.0$/, '')}만`
  }
  return value.toLocaleString('ko-KR')
}

// ─── SVG 하트 아이콘 (채워진/빈) ─────────────────────────────────────────────
function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {filled ? (
        <>
          <defs>
            <linearGradient id="hfill-lv" x1="9" y1="2" x2="9" y2="16" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ff6fa3" />
              <stop offset="100%" stopColor="#e8325a" />
            </linearGradient>
          </defs>
          <path
            d="M9 15.5C9 15.5 2 10.5 2 6C2 3.8 3.8 2 6 2C7.4 2 8.6 2.8 9 3.9C9.4 2.8 10.6 2 12 2C14.2 2 16 3.8 16 6C16 10.5 9 15.5 9 15.5Z"
            fill="url(#hfill-lv)"
          />
        </>
      ) : (
        <path
          d="M9 15.5C9 15.5 2 10.5 2 6C2 3.8 3.8 2 6 2C7.4 2 8.6 2.8 9 3.9C9.4 2.8 10.6 2 12 2C14.2 2 16 3.8 16 6C16 10.5 9 15.5 9 15.5Z"
          fill="none"
          stroke="#d1aabb"
          strokeWidth="1.5"
        />
      )}
    </svg>
  )
}

// ─── SVG 코인 아이콘 ──────────────────────────────────────────────────────────
function CoinIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="9" fill="#F8C400" stroke="#E6A800" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="6.5" fill="#FFE066" />
      <text x="10" y="14" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#B8860B">
        C
      </text>
    </svg>
  )
}

// ─── 메인 컴포넌트 — ref: Mission Complete 하트 줄 (파티클·도달 애니) ───────
const ChildLevelStatsCard = forwardRef<HTMLDivElement, ChildLevelStatsCardProps>(function ChildLevelStatsCard(
  {
  stats,
  filledHearts,
  creditRef,
  shine = false,
  className = '',
  },
  ref,
) {
  const { current_level, exp, exp_to_next_level, credits } = stats

  /** 직전 완주 하트 수 — 늘어난 직후 한 칸에만 `차오름` 연출 */
  const prevFilled = useRef(filledHearts)
  const [burstIndex, setBurstIndex] = useState<number | null>(null)
  useLayoutEffect(() => {
    if (filledHearts > prevFilled.current) {
      setBurstIndex(filledHearts - 1)
      const t = window.setTimeout(() => setBurstIndex(null), 650)
      prevFilled.current = filledHearts
      return () => clearTimeout(t)
    }
    prevFilled.current = filledHearts
    return undefined
  }, [filledHearts])

  // 경험치 진행률 (0~100%)
  const progressPct = useMemo(() => {
    if (!exp_to_next_level || exp_to_next_level <= 0) return 100
    return Math.min(100, Math.round((exp / exp_to_next_level) * 100))
  }, [exp, exp_to_next_level])

  const totalCredits = credits ?? 0

  return (
    /**
     * 카드 컨테이너
     * - w-fit: 내용 너비에 맞게 자동 축소 → 캐릭터를 덜 가림
     * - min-w-[150px]: 너무 좁아지지 않도록 최소 너비 지정
     * - bg-white/40 backdrop-blur-sm: 반투명 유리질 배경
     */
    <div
      className={[
        'w-fit rounded-2xl bg-white/40 backdrop-blur-sm shadow-md px-3 pt-2.5 pb-3',
        className,
      ].join(' ')}
      role="region"
      aria-label={`레벨 ${current_level} 스탯 카드`}
    >
      {/* ── 상단 행: Lv.n + 경험치 (부모/DB current_level과 동일) ─────────────── */}
      {/* justify-between 제거 → 내용 너비에 딱 맞게 붙여서 카드 폭을 줄입니다 */}
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[14px] font-black text-[#5A3E28] tracking-wide leading-none whitespace-nowrap">
          Lv.{current_level}
        </span>
        <span className="text-[10px] font-bold text-[#7A5C3A] tabular-nums leading-none whitespace-nowrap">
          {exp}/{exp_to_next_level}
        </span>
      </div>

      {/* ── 경험치 진행 바 ───────────────────────────────────────────────── */}
      <div
        className="w-full h-[6px] rounded-full bg-white/50 overflow-hidden mb-2.5"
        role="progressbar"
        aria-valuenow={exp}
        aria-valuemin={0}
        aria-valuemax={exp_to_next_level}
        aria-label={`경험치 ${exp} / ${exp_to_next_level}`}
      >
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${progressPct}%`,
            background: 'linear-gradient(90deg, #FF8C00 0%, #FFD700 100%)',
            boxShadow: '0 1px 3px rgba(255, 140, 0, 0.45)',
          }}
        />
      </div>

      {/* ── 구분선 ──────────────────────────────────────────────────────── */}
      <div className="w-full h-px bg-white/40 mb-2" />

      {/* ── MISSION COMPLETE — 오늘 미션 완주율 하트 ─────────────────────── */}
      {/* 비개발자 설명: 미션을 얼마나 완료했는지를 하트 5개로 표시합니다. */}
      <p className="text-[8px] font-extrabold text-[#7A5C3A] uppercase tracking-wider leading-none mb-1.5">
        Mission Complete
      </p>
      <div
        ref={ref}
        className="flex gap-0.5 mb-2.5"
        aria-label={`미션 하트 ${filledHearts}/5`}
      >
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={burstIndex === i ? 'mission-heart-slot-fill' : 'inline-flex'}
          >
            <HeartIcon filled={i < filledHearts} />
          </span>
        ))}
      </div>

      {/* ── 구분선 ──────────────────────────────────────────────────────── */}
      <div className="w-full h-px bg-white/40 mb-2" />

      {/* ── CREDITS — 현재 보유 총 크레딧 ────────────────────────────────── */}
      {/*
       * 비개발자 설명: 미션 완료 시 코인 파티클이 이 영역으로 날아옵니다.
       * creditRef 를 달아 ChildScreen 이 이 DOM 요소의 화면 위치를 파티클 목적지로 사용합니다.
       * shine = true 일 때 숫자가 황금빛으로 잠깐 커집니다 (기존 노란 배지의 반짝임 효과 동일).
       */}
      <p className="text-[8px] font-extrabold text-[#7A5C3A] uppercase tracking-wider leading-none mb-1.5">
        Credits
      </p>
      <div
        ref={creditRef}
        className="flex items-center gap-1"
      >
        <CoinIcon size={15} />
        <span
          className="text-[13px] font-black text-[#4A3520] tabular-nums leading-none transition-transform duration-200"
          style={shine ? { animation: 'badgeShine 0.6s ease-out' } : undefined}
        >
          {formatCredits(totalCredits)}
        </span>
      </div>
    </div>
  )
})

ChildLevelStatsCard.displayName = 'ChildLevelStatsCard'

export default ChildLevelStatsCard
