'use client'

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
  /** 서버에서 미리 계산한 최근 7일 루틴 완주율(요일 라벨 포함) */
  weeklyRoutine: WeeklyRoutineDay[]
  /** 성장 단계 한글 이름(씨앗, 새싹 …) */
  growthStageName: string
  childName: string
}

/**
 * 부모 홈 「우리아이 경제 EQ 지수」 카드
 *
 * - 만족 지연(반원) + 소비/저축(도넛)은 **한 줄 두 칸**, 그 아래 요일별 막대
 * - 만족 지연 지수만 수치 해석 한 줄(높을수록 좋음) 안내, 소비/저축 범례는 한 줄 가로 배치.
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

  const savePct = Math.min(100, Math.max(0, stats.eq_save_ratio))
  const spendPct = 100 - savePct

  return (
    <section className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
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
              자기조절력(기다림·참기·나누기)은 높을수록 좋아요
            </p>
          </div>

          <div className="rounded-xl bg-gray-50/80 px-2 py-2.5 flex flex-col min-w-0">
            <p className="text-[10px] font-bold text-gray-600 mb-0.5 text-center leading-tight">
              소비 vs 저축 비중
            </p>
            <SaveSpendDonut savePercent={savePct} spendPercent={spendPct} compact />
          </div>
        </div>

        <div className="rounded-xl bg-gray-50/80 px-2 py-3">
          <p className="text-[11px] font-bold text-gray-600 mb-2 text-center">일일 루틴 완주율 (최근 7일)</p>
          <WeekdayRoutineBars days={weeklyRoutine} />
        </div>
      </div>

      <div className="rounded-2xl border border-[#4A90E2]/15 bg-gradient-to-r from-[#4A90E2]/10 to-[#7ED321]/10 px-3.5 py-3">
        <p className="text-[10px] font-bold text-[#4A90E2] mb-1">AI 인사이트 (데이터 피드백)</p>
        <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{dataFeedback}</p>
      </div>

      <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 px-3.5 py-3">
        <p className="text-[10px] font-bold text-amber-800 mb-1">경제 습관 코칭 가이드 (부모님용)</p>
        <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{coachingGuide}</p>
      </div>
    </section>
  )
}

function WeekdayRoutineBars({ days }: { days: WeeklyRoutineDay[] }) {
  return (
    <div className="flex items-end justify-between gap-1.5 h-28 px-1">
      {days.map((d) => {
        const h = d.hasMissions ? d.ratePercent : 0
        const title = d.hasMissions
          ? `${d.date} (${d.weekdayShort}): ${d.ratePercent}% 완주`
          : `${d.date} (${d.weekdayShort}): 배정된 미션 없음`
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1 min-w-0" title={title}>
            <div className="w-full flex flex-col-reverse h-[72px] bg-gray-200/60 rounded-lg overflow-hidden justify-end">
              <div
                className={[
                  'w-full rounded-lg transition-all duration-500 min-h-[2px]',
                  d.hasMissions ? 'bg-[#4A90E2]' : 'bg-transparent',
                ].join(' ')}
                style={{ height: d.hasMissions ? `${h}%` : '4px' }}
              />
            </div>
            <span className="text-[10px] font-bold text-gray-500 tabular-nums">{d.weekdayShort}</span>
          </div>
        )
      })}
    </div>
  )
}

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
