'use client'

/**
 * 부모 홈 「우리아이 경제 EQ 지수」 패널입니다.
 * - 저축 습관(반원 게이지) + 주간 루틴 완료율(막대)을 3:7 비율로 한 블록에 배치합니다.
 * - 하단 EQ 지수 종합: 저축 비율·루틴 완주율을 원형 게이지로 표시합니다.
 */

import { createPortal } from 'react-dom'
import { useEffect, useId, useState } from 'react'
import type { ChildStats } from '@/types/database'
import type { WeeklyRoutineDay } from '@/lib/childWeeklyRoutine'
import { type AgentEqScores, type AgentLatestReportRow } from '@/lib/agentApi'
import { PARENT_NEUTRAL_CARD_CLASSNAME } from '@/lib/parentNeutralBlockStyle'

/** 차트·피드백에 필요한 `child_stats` 일부 + 레벨 뱃지 표시용 레벨 */
export type EconomicEqStatsSlice = Pick<
  ChildStats,
  | 'eq_routine_rate'
  | 'eq_delay_score'
  | 'eq_save_ratio'
  | 'streak_days'
  | 'credits'
  | 'credits_wallet'
  | 'credits_piggy'
  | 'current_level'
>

type Props = {
  stats: EconomicEqStatsSlice
  /** 이번 주(월~일) 루틴 완주율 막대 */
  weeklyRoutine: WeeklyRoutineDay[]
  childName: string
  agentChildId?: string | null
  agentRow?: AgentLatestReportRow | null
  agentLoading?: boolean
  /** false 이면 주간 루틴·완주율 블록 숨김(홈 좌측 활성 열용). */
  showWeeklyRoutine?: boolean
  /** false 이면 제목·EQ 지수 종합만 숨김(홈 우측 비활성 열용). */
  showEqSummary?: boolean
}

// ─── 저축 습관 설명 모달 ──────────────────────────────────────────────────────

function EqDelayExplainModal({
  onClose,
  childName,
  savingsRate,
}: {
  onClose: () => void
  childName: string
  savingsRate: number
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/45 px-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="eq-delay-modal-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="닫기" onClick={onClose} />
      <div className="relative z-[1] flex max-h-[min(88dvh,32rem)] w-full max-w-none flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl ring-1 ring-black/[0.06] sm:mx-auto sm:max-w-md sm:rounded-3xl">
        <div className="shrink-0 border-b border-gray-100 px-4 py-3">
          <h2 id="eq-delay-modal-title" className="text-center text-sm font-bold text-gray-900">
            저축 습관
          </h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="text-xs text-gray-700 leading-relaxed">
            <div className="bg-blue-50 rounded-xl p-4 mb-4">
              <p className="text-xs text-blue-500 font-medium mb-1">지금 {childName}이는</p>
              <p className="text-base font-bold text-blue-900">
                {savingsRate < 20
                  ? '대부분의 크레딧을 지갑에서 쓰고 있어요'
                  : savingsRate < 50
                    ? '저금통보다 지갑 사용이 조금 더 많아요'
                    : savingsRate < 80
                      ? '저금통에 잘 모으고 있어요'
                      : '대부분의 크레딧을 저금통에 모으고 있어요'}
              </p>
              <p className="text-sm text-blue-700 mt-1">
                전체 크레딧 중 저금통에 {savingsRate}%가 있어요
              </p>
            </div>
            <p className="text-sm text-gray-600">
              전체 크레딧 중 저금통에 보관된 비율이에요. 당장 쓰지 않고 나중을 위해 모아두는 습관을 보여줘요.
            </p>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 font-medium mb-1">참고</p>
              <p className="text-sm text-gray-500">
                높을수록 저축 습관이 잘 잡혀있다는 신호예요. 미션 보상을 받은 뒤 저금통으로 옮기는 연습을 함께
                해보세요.
              </p>
              <p className="text-xs text-gray-400 mt-2">
                7일 이상 미션을 수행하면 실제 행동 패턴 기반으로 업데이트돼요.
              </p>
            </div>
          </div>
        </div>
        <div className="shrink-0 border-t border-gray-100 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-[#4A90E2] py-2.5 text-sm font-bold text-white active:scale-[0.99]"
          >
            확인
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ─── 반원 게이지 (범용) ──────────────────────────────────────────────────────

function DelayHalfGauge({
  value,
  gradientId,
  startColor = '#93C5FD',
  endColor = '#2563EB',
}: {
  value: number
  gradientId: string
  startColor?: string
  endColor?: string
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
      className="h-[4.25rem] w-full mx-auto block max-w-[120px]"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={startColor} />
          <stop offset="100%" stopColor={endColor} />
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

// ─── 전체 원형 게이지 (저축 비율·루틴 완주율) ───────────────────────────────

/**
 * 반원 게이지 스타일을 360° 전체 원형으로 확장합니다.
 * 12시 방향에서 시작해 시계 방향으로 채워집니다.
 */
function EqCircleGauge({
  value,
  gradientId,
  label,
  startColor,
  endColor,
}: {
  value: number
  gradientId: string
  label: string
  startColor: string
  endColor: string
}) {
  const v = Math.min(100, Math.max(0, Math.round(value)))
  const r = 34
  const cx = 50
  const cy = 50
  const circumference = 2 * Math.PI * r
  const filled = (v / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-[4.5rem] w-[4.5rem]">
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={startColor} />
              <stop offset="100%" stopColor={endColor} />
            </linearGradient>
          </defs>
          {/* 배경 트랙 */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* 값 채우기 — 12시 방향 시작 */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        </svg>
        {/* 중앙 퍼센트 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[13px] font-black tabular-nums text-gray-700">{v}%</span>
        </div>
      </div>
      <span className="text-[10px] font-bold text-gray-500 text-center">{label}</span>
    </div>
  )
}

// ─── EQ 지수 종합 (저축 비율·저축 습관 원형 게이지) ────────────────────────

/**
 * 저축 관련 두 지표를 원형 게이지로 나란히 보여 줍니다.
 * - 저축 비율: eq_scores.save_ratio (저금통 이체 비율)
 * - 저축 습관: eq_scores.delay_satisfaction (만족 지연 지수)
 * 스타일은 주간 루틴 블록·홈「오늘의 진행도」와 동일 — `PARENT_NEUTRAL_CARD_CLASSNAME`.
 */
function EqScoreCircles({
  eq,
  gradSaveId,
  gradHabitId,
}: {
  eq: AgentEqScores | null | undefined
  gradSaveId: string
  gradHabitId: string
}) {
  const save  = Number(eq?.save_ratio         ?? 0)
  const habit = Number(eq?.delay_satisfaction ?? 0)

  return (
    <div className={`${PARENT_NEUTRAL_CARD_CLASSNAME} px-3 py-3`}>
      <p className="mb-3 text-[11px] font-bold text-gray-600 text-center">EQ 지수 종합</p>
      <div className="flex items-start justify-around gap-2">
        <EqCircleGauge
          value={save}
          gradientId={gradSaveId}
          label="저축 비율"
          startColor="#86efac"
          endColor="#10b981"
        />
        <EqCircleGauge
          value={habit}
          gradientId={gradHabitId}
          label="저축 습관"
          startColor="#fcd34d"
          endColor="#f59e0b"
        />
      </div>
    </div>
  )
}

// ─── 요일별 루틴 완료율 막대 ─────────────────────────────────────────────────

function WeekdayRoutineBars({ days }: { days: WeeklyRoutineDay[] }) {
  if (!Array.isArray(days) || days.length === 0) {
    return (
      <div className="rounded-lg bg-white/70 px-2 py-3 text-center text-[11px] font-bold text-gray-400">
        이번 주 루틴 데이터가 아직 없어요.
      </div>
    )
  }

  return (
    <div className="flex items-end justify-between gap-1 min-h-[5.5rem]">
      {days.map((d) => {
        const h = d.hasMissions ? d.ratePercent : 0
        const title = d.hasMissions
          ? `${d.date} (${d.weekdayShort}): ${d.ratePercent}% 완주`
          : `${d.date} (${d.weekdayShort}): 배정된 미션 없음`
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-0.5 min-w-0" title={title}>
            <div className="w-full flex flex-col justify-end h-[52px] bg-gray-200/60 rounded-full overflow-hidden">
              <div
                className={[
                  'w-full rounded-full transition-all duration-500',
                  d.hasMissions ? 'bg-[#4A90E2] min-h-[2px]' : 'bg-transparent h-0 min-h-0',
                ].join(' ')}
                style={d.hasMissions ? { height: `${h}%` } : undefined}
              />
            </div>
            <div className="flex flex-col items-center leading-tight">
              <span className="text-[9px] font-bold text-gray-500 tabular-nums">{d.weekdayShort}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── 메인 패널 ───────────────────────────────────────────────────────────────

export default function EconomicEqPanel({
  stats,
  weeklyRoutine,
  childName,
  agentChildId,
  agentRow,
  showWeeklyRoutine = true,
  showEqSummary = true,
}: Props) {
  const gradId = useId().replace(/:/g, '')

  // 이번 주 미션이 배정된 날들의 평균 완주율 (0~100)
  const daysWithMissions = weeklyRoutine.filter((d) => d.hasMissions)
  const weeklyCompletionRate =
    daysWithMissions.length > 0
      ? Math.round(daysWithMissions.reduce((sum, d) => sum + d.ratePercent, 0) / daysWithMissions.length)
      : 0

  return (
    <section className="w-full space-y-4">
      {showEqSummary ? (
        <>
          <p className="text-sm font-bold text-gray-700">우리아이 경제 EQ 지수</p>
          <EqScoreCircles
            eq={agentRow?.eq_scores as AgentEqScores | null}
            gradSaveId={`eq-save-${gradId}`}
            gradHabitId={`eq-habit-${gradId}`}
          />
        </>
      ) : null}

      {showWeeklyRoutine ? (
      <div className={`${PARENT_NEUTRAL_CARD_CLASSNAME} px-3 py-3`}>
        <div className="flex gap-3">
          {/* 주간 루틴 완료율 막대 — 7/10 너비 (좌측) */}
          <div className="flex flex-[7] flex-col gap-1.5">
            <p className="text-[10px] font-bold text-gray-600 text-center">주간 루틴 완료율</p>
            <WeekdayRoutineBars days={weeklyRoutine} />
          </div>

          {/* 구분선 */}
          <div className="w-px self-stretch bg-gray-200/80" />

          {/* 루틴 완주율 반원 게이지 — 3/10 너비 (우측) */}
          <div className="flex flex-[3] flex-col items-center justify-center gap-0">
            <span className="text-[10px] font-bold text-gray-600 mb-0.5 text-center">루틴 완주율</span>
            <div className="w-full flex flex-col items-center">
              <DelayHalfGauge
                value={weeklyCompletionRate}
                gradientId={`routine-${gradId}`}
                startColor="#6EE7B7"
                endColor="#059669"
              />
              <div className="-mt-5 flex flex-col items-center">
                <span className="text-base font-black leading-none text-emerald-600 tabular-nums">
                  {weeklyCompletionRate}%
                </span>
                <span className="mt-0.5 text-[9px] text-gray-400">이번 주 평균</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      ) : null}
    </section>
  )
}
