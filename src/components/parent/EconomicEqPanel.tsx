'use client'

import Link from 'next/link'
import { useId } from 'react'
import type { ChildStats } from '@/types/database'
import type { WeeklyRoutineDay } from '@/lib/childWeeklyRoutine'
import {
  buildPlaceholderCoachingGuide,
  buildPlaceholderEqDataFeedback,
} from '@/lib/childEqAiPlaceholders'

/** 차트·피드백에 필요한 `child_stats` 일부만 받습니다(부모 홈 요약 객체와 맞춤). */
export type EconomicEqStatsSlice = Pick<
  ChildStats,
  'eq_routine_rate' | 'eq_delay_score' | 'eq_save_ratio' | 'streak_days' | 'credits'
>

type Props = {
  stats: EconomicEqStatsSlice
  /** 서버에서 미리 계산한 이번 주(월~일) 루틴 완주율 */
  weeklyRoutine: WeeklyRoutineDay[]
  /** 성장 단계 한글 이름(씨앗, 새싹 …) */
  growthStageName: string
  childName: string
}

/**
 * 부모 홈 「우리아이 경제 EQ 지수」 카드
 *
 * - **순서**: 먼저 AI 데이터 피드백(그라데이션 박스), 그다음 차트 묶음(제목+반원·도넛·주간 막대), 마지막 코칭 가이드
 * - 만족 지연(반원) + 소비/저축(도넛)은 **한 줄 두 칸**, 그 아래 요일별 막대
 * - **데이터**: `eq_delay_score`·`eq_save_ratio` 는 DB 의 `recalculate_eq()` 가
 *   `child_stats`(지갑·저금통·총액)와 `mission_logs` 로 채웁니다. 섬(가용)=총액−지갑−저금통 은 도넛 분모에 넣지 않습니다.
 * - AI 인사이트는 분석 문구만 두고, **행동 유도 링크는 코칭 가이드 아래 2개**(스페셜 미션·마켓 보상)만 둡니다.
 */
export default function EconomicEqPanel({
  stats,
  weeklyRoutine,
  growthStageName,
  childName,
}: Props) {
  const gradId = useId().replace(/:/g, '')

  const insightInput = {
    stats: {
      eq_routine_rate: stats.eq_routine_rate,
      eq_delay_score: stats.eq_delay_score,
      eq_save_ratio: stats.eq_save_ratio,
      streak_days: stats.streak_days,
      credits: stats.credits,
    },
    growthStageName,
    childName,
    weeklyRoutine,
  }

  const dataFeedback = buildPlaceholderEqDataFeedback(insightInput)
  const coachingGuide = buildPlaceholderCoachingGuide(insightInput)

  // eq_save_ratio: 지갑+저금통 중 저금통 비중(0~100). 소비(파랑)=지갑, 저축(노랑)=저금통.
  const savePct = Math.min(100, Math.max(0, stats.eq_save_ratio))
  const spendPct = 100 - savePct

  return (
    <section className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
      {/* AI가 숫자를 바탕으로 요약한 피드백 — 카드 상단에 두어 먼저 읽히게 함 */}
      <div className="rounded-2xl border border-[#4A90E2]/15 bg-gradient-to-r from-[#4A90E2]/10 to-[#7ED321]/10 px-3.5 py-3">
        <p className="text-[10px] font-bold text-[#4A90E2] mb-1">AI 인사이트 (데이터 피드백)</p>
        <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{dataFeedback}</p>
      </div>

      <p className="text-sm font-bold text-gray-700">우리아이 경제 EQ 지수</p>

      <div className="flex flex-col gap-5">
        {/* 만족 지연 + 소비/저축: 한 줄에 좌·우 두 블록 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-gray-50/80 px-2 py-2.5 flex flex-col min-w-0">
            <p className="text-[10px] font-bold text-gray-600 mb-0.5 text-center leading-tight">
              만족 지연 지수
            </p>
            <DelayHalfGauge value={stats.eq_delay_score} gradientId={`delay-${gradId}`} compact />
            <p className="text-center text-[11px] font-bold text-[#4A90E2] tabular-nums -mt-0.5">
              {stats.eq_delay_score}%
            </p>
            <p className="text-[8px] text-gray-400 text-center mt-1 leading-tight px-0.5">
              총 크레딧 중 저금통에 둔 비율이에요. 섬(가용)만 많으면 낮게 보일 수 있어요.
            </p>
          </div>

          <div className="rounded-xl bg-gray-50/80 px-2 py-2.5 flex flex-col min-w-0">
            <p className="text-[10px] font-bold text-gray-600 mb-0.5 text-center leading-tight">
              소비 vs 저축 비중
            </p>
            <SaveSpendDonut savePercent={savePct} spendPercent={spendPct} compact />
            <p className="text-[7px] text-gray-400 text-center mt-0.5 leading-tight px-0.5">
              지갑·저금통으로 나눈 금액만 비교(섬·가용 제외)
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-gray-50/80 px-2 py-3">
          <p className="text-[11px] font-bold text-gray-600 mb-2 text-center">일일 루틴 완주율 (이번 주)</p>
          <WeekdayRoutineBars days={weeklyRoutine} />
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 px-3.5 py-3">
        <p className="text-[10px] font-bold text-amber-800 mb-1">경제 습관 코칭 가이드 (부모님용)</p>
        <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{coachingGuide}</p>

        {/* 코칭 다음 행동: 한 줄짜리 문구만 두어 줄바꿈이 어색해지지 않게 함(탭 이동은 링크 목적지로 처리) */}
        <div
          className="mt-3 grid grid-cols-2 gap-2.5 border-t border-amber-200/50 pt-3"
          role="group"
          aria-label="코칭에 이어 실천하기"
        >
          <Link
            href="/parent/routine#parent-routine-special-missions"
            className="flex min-h-[3.5rem] items-center justify-center rounded-xl border border-amber-200 bg-white px-2 py-2.5 text-center text-[11px] font-bold leading-tight text-amber-950 shadow-sm ring-1 ring-amber-100/80 transition-colors active:scale-[0.99] hover:border-amber-300 hover:bg-amber-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
          >
            스페셜 미션 제안하기
          </Link>
          <Link
            href="/parent/approval#parent-approval-market-rewards"
            className="flex min-h-[3.5rem] items-center justify-center rounded-xl border border-amber-200 bg-white px-2 py-2.5 text-center text-[11px] font-bold leading-tight text-amber-950 shadow-sm ring-1 ring-amber-100/80 transition-colors active:scale-[0.99] hover:border-amber-300 hover:bg-amber-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
          >
            특별 보상 제안하기
          </Link>
        </div>
      </div>
    </section>
  )
}

/**
 * 요일별 막대: 회색 트랙은 100% 높이, 파란 막대는 **아래에서 위로** 차오릅니다.
 * (`flex-col-reverse`+`justify-end`는 막대가 위에 붙어 내려 채워지는 것처럼 보일 수 있어 `flex-col`+`justify-end`만 사용합니다.)
 */
function WeekdayRoutineBars({ days }: { days: WeeklyRoutineDay[] }) {
  return (
    <div className="flex items-end justify-between gap-1.5 min-h-[7.5rem] px-1">
      {days.map((d) => {
        const h = d.hasMissions ? d.ratePercent : 0
        const title = d.hasMissions
          ? `${d.date} (${d.weekdayShort}): ${d.ratePercent}% 완주`
          : `${d.date} (${d.weekdayShort}): 배정된 미션 없음`
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1 min-w-0" title={title}>
            {/* 트랙: 세로 알약 형태, 안쪽은 아래 정렬 후 높이 %만큼만 채움 */}
            <div className="w-full flex flex-col justify-end h-[72px] bg-gray-200/60 rounded-full overflow-hidden">
              <div
                className={[
                  'w-full rounded-full transition-all duration-500',
                  d.hasMissions ? 'bg-[#4A90E2] min-h-[2px]' : 'bg-transparent h-0 min-h-0',
                ].join(' ')}
                style={d.hasMissions ? { height: `${h}%` } : undefined}
              />
            </div>
            <div className="flex flex-col items-center leading-tight">
              <span className="text-[10px] font-bold text-gray-500 tabular-nums">{d.weekdayShort}</span>
              <span className="text-[8px] text-gray-400 tabular-nums">{d.dateLabelShort}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** 반원 게이지 — `eq_delay_score`(총액 대비 저금통 %) 를 시각화합니다. */
function DelayHalfGauge({
  value,
  gradientId,
  compact = false,
}: {
  value: number
  gradientId: string
  /** 한 줄 두 칸 레이아웃일 때 더 작게 */
  compact?: boolean
}) {
  const v = Math.min(100, Math.max(0, value))
  const r = 36
  const cx = 50
  const cy = 52
  const arcLen = Math.PI * r
  const filled = (v / 100) * arcLen

  return (
    <svg
      viewBox="0 0 100 58"
      className={[
        'w-full mx-auto block',
        compact ? 'h-[4.75rem] max-w-[130px]' : 'max-w-[220px] h-[7.25rem]',
      ].join(' ')}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>
      </defs>
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${arcLen}`}
      />
    </svg>
  )
}

/**
 * 도넛: 노랑=저금통(저축), 파랑=지갑(소비). 퍼센트는 DB 가 지갑+저금통 합계를 분모로 계산합니다.
 */
function SaveSpendDonut({
  savePercent,
  spendPercent,
  compact = false,
}: {
  savePercent: number
  spendPercent: number
  compact?: boolean
}) {
  const saveDeg = (savePercent / 100) * 360

  const ring = compact ? 'h-[5.25rem] w-[5.25rem]' : 'h-[7.5rem] w-[7.5rem]'
  const hole = compact ? 'inset-[20%]' : 'inset-[22%]'
  const centerSave = compact ? 'text-[9px]' : 'text-sm'
  const centerLabel = compact ? 'text-[8px]' : 'text-[10px]'
  // compact(좁은 칸)에서도 저축·소비 범례는 줄바꿈 없이 한 줄
  const legendClass = compact
    ? 'flex flex-row flex-nowrap justify-center items-center gap-x-2 text-[8px] text-gray-600 w-full min-w-0'
    : 'flex flex-row flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-gray-600'

  return (
    <div className={['flex flex-col items-center', compact ? 'gap-1' : 'gap-2'].join(' ')}>
      <div
        className={['relative rounded-full shadow-inner', ring].join(' ')}
        style={{
          background: `conic-gradient(#F8E71C 0deg ${saveDeg}deg, #4A90E2 ${saveDeg}deg 360deg)`,
        }}
      >
        <div
          className={[
            'absolute rounded-full bg-white flex flex-col items-center justify-center shadow-sm',
            hole,
          ].join(' ')}
        >
          <span className={`${centerLabel} text-gray-500`}>저축</span>
          <span className={`${centerSave} font-black text-gray-800 tabular-nums leading-none`}>
            {savePercent}%
          </span>
        </div>
      </div>
      <div className={legendClass}>
        <span className="whitespace-nowrap">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#F8E71C] mr-1 align-middle" />
          저축 {savePercent}%
        </span>
        <span className="whitespace-nowrap">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#4A90E2] mr-1 align-middle" />
          소비 {spendPercent}%
        </span>
      </div>
    </div>
  )
}
