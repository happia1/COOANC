'use client'

/**
 * 부모 홈 「우리아이 경제 EQ 지수」 패널입니다.
 * - 상단: AI 리포트 카드(JSON `report_text` 파싱) — 캘린더 안내, 레벨, 루틴, 크레딧(글만), 위시, 응원, 부모 가이드
 * - 메인에는 퍼센트 숫자를 크게 강조하지 않고, 주간 루틴 완료율 막대는 카드 본문에서도 바로 보여 줍니다.
 * - `eq_delay_score` 반원 게이지는 「저축 습관」이라는 이름으로 남기고, 탭하면 계산 설명 모달이 열립니다.
 */

import { createPortal } from 'react-dom'
import { useEffect, useId, useState } from 'react'
import type { ChildStats } from '@/types/database'
import type { WeeklyRoutineDay } from '@/lib/childWeeklyRoutine'
import ParentAgentBottomSheet from '@/components/parent/ParentAgentBottomSheet'
import {
  parseAgentReportPayload,
  type AgentEqScores,
  type AgentLatestReportRow,
  type AgentReportJsonV1,
} from '@/lib/agentApi'

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
  /** 이번 주(월~일) 루틴 완주율 — 드릴다운 시트 안에서만 막대로 보여 줍니다. */
  weeklyRoutine: WeeklyRoutineDay[]
  childName: string
  /** 있으면 `/agent-a/latest` 로 받은 `agentRow` 를 카드 형태로 풀어 그립니다. */
  agentChildId?: string | null
  agentRow?: AgentLatestReportRow | null
  agentLoading?: boolean
}

/**
 * 저축 습관(반원 게이지) 설명 모달 — 본문에는 **큰 퍼센트 숫자를 넣지 않고** 말로만 해석합니다.
 */
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
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/45 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="eq-delay-modal-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="닫기" onClick={onClose} />
      <div className="relative z-[1] flex max-h-[min(88dvh,32rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/[0.06] sm:rounded-3xl">
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

/** 카드 래퍼 — 흰 배경·둥근 모서리로 리포트 문단을 구분합니다. */
function ReportCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={['rounded-xl border border-gray-100 bg-white p-3 text-sm text-gray-800 shadow-sm', className ?? ''].join(' ')}>
      {children}
    </div>
  )
}

/** EQ 지수(에이전트 분석) 막대 — 상세 팝업 하단에서 보여 줍니다. */
function EqScoreBars({ eq }: { eq: AgentEqScores | null | undefined }) {
  const delay = Math.min(100, Math.max(0, Number(eq?.delay_satisfaction ?? 0)))
  const save = Math.min(100, Math.max(0, Number(eq?.save_ratio ?? 0)))
  const routine = Math.min(100, Math.max(0, Number(eq?.routine_completion ?? 0)))
  const rows = [
    { label: '저축 습관', value: delay, color: 'from-amber-200 to-orange-300' },
    { label: '저축 비율', value: save, color: 'from-lime-200 to-emerald-300' },
    { label: '루틴 완주율', value: routine, color: 'from-sky-200 to-blue-400' },
  ]
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-bold text-gray-600">EQ 지수 (에이전트 분석)</p>
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex justify-between text-[10px] font-bold text-gray-500">
            <span>{r.label}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${r.color} transition-all duration-500`}
              style={{ width: `${r.value}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function EconomicEqPanel({
  stats,
  weeklyRoutine,
  childName,
  agentChildId,
  agentRow,
  agentLoading,
}: Props) {
  const gradId = useId().replace(/:/g, '')
  const [delayExplainOpen, setDelayExplainOpen] = useState(false)
  const [creditDrillOpen, setCreditDrillOpen] = useState(false)

  const parsed = parseAgentReportPayload(agentRow?.report_text ?? null)
  const jsonReport: AgentReportJsonV1 | null = parsed.kind === 'json' ? parsed.data : null
  const legacyText = parsed.kind === 'legacy' ? parsed.text : ''

  const drill = jsonReport?.drill_down

  const showAgentBlock = Boolean(agentChildId)
  // 현재 잔액 기준 저축 습관 비율: 저금통 / (돈바구니 + 지갑 + 저금통)
  const totalCredits = (stats.credits ?? 0) + (stats.credits_wallet ?? 0) + (stats.credits_piggy ?? 0)
  const savingsRate = totalCredits > 0 ? Math.round(((stats.credits_piggy ?? 0) / totalCredits) * 100) : 0

  return (
    <section className="w-full bg-white rounded-2xl p-4 shadow-sm space-y-4">
      <p className="text-sm font-bold text-gray-700">우리아이 경제 EQ 지수</p>

      {/* ── AI 리포트 카드(JSON 또는 예전 한 덩어리 텍스트) ───────────────── */}
      {showAgentBlock ? (
        <div className="space-y-3">
          {agentLoading && !agentRow ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-sky-100 bg-sky-50/40 py-4">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-200 border-t-sky-500" aria-hidden />
              <span className="text-xs font-bold text-sky-800">AI 리포트 불러오는 중…</span>
            </div>
          ) : null}

          {parsed.kind === 'json' && jsonReport ? (
            <>
              <ReportCard>
                <p className="mb-2 text-xs font-bold text-gray-600">크레딧·저축 이야기</p>
                <p className="whitespace-pre-wrap text-[12px] font-normal leading-relaxed text-gray-700">
                  {jsonReport.credit_comment?.trim() || '크레딧 코멘트를 준비 중이에요.'}
                </p>
                <button
                  type="button"
                  onClick={() => setCreditDrillOpen(true)}
                  className="mt-3 text-xs font-black text-[#4A90E2] underline-offset-2 hover:underline"
                >
                  그래프 보기 →
                </button>
              </ReportCard>

              {Array.isArray(jsonReport.wishlist_items) && jsonReport.wishlist_items.length > 0 ? (
                <ReportCard>
                  <p className="text-[10px] font-bold text-gray-500 mb-2">위시리스트</p>
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
                    {jsonReport.wishlist_comment?.trim() || '아이가 바라는 목표를 응원해 주세요.'}
                  </p>
                </ReportCard>
              ) : null}

            </>
          ) : legacyText.trim() ? (
            <ReportCard>
              <p className="text-[10px] font-bold text-gray-500 mb-2">AI 인사이트 (이전 형식)</p>
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{legacyText}</p>
            </ReportCard>
          ) : null}
        </div>
      ) : null}

      {/* 캘린더·카드 글 아래에 두는 저축 습관 반원(메인에는 % 숫자 없음) */}
      <div className="rounded-xl bg-gray-50/80 px-3 py-3">
        <button
          type="button"
          onClick={() => setDelayExplainOpen(true)}
          className="w-full text-left cursor-pointer transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2 rounded-lg"
          aria-haspopup="dialog"
          aria-label="저축 습관 설명 보기"
        >
          {/* 현재는 child_stats 현재 잔액 기준으로 즉시 계산된 값을 보여 줍니다. */}
          <p className="mb-2 text-center text-[11px] font-bold text-gray-600">저축 습관(현재 잔액 기준)</p>
          <div className="-mt-2 pointer-events-none flex flex-col items-center">
            {/* 반원 게이지 자체에는 텍스트를 겹치지 않고, 아래 플로우로 분리해 겹침을 방지합니다. */}
            <div className="relative">
              <DelayHalfGauge value={savingsRate} gradientId={`delay-${gradId}`} compact />
            </div>
            <div className="-mt-8 flex flex-col items-center">
              <span className="text-2xl font-bold leading-none text-blue-600">{savingsRate}%</span>
              <span className="mt-1 text-[11px] text-gray-400">저금통 비율</span>
            </div>
          </div>
        </button>
      </div>

      {/**
       * 주간 루틴 완료율(이번 주) 블록:
       * - 이전 홈 화면 구성처럼 EQ 카드 본문에서도 요일별 완주 막대를 바로 확인할 수 있게 복구합니다.
       * - 막대를 누르면 상호작용은 없고, 상세 숫자 설명은 아래 "그래프 보기" 시트에서 이어서 볼 수 있습니다.
       */}
      <div className="rounded-xl bg-gray-50/80 px-2 py-3">
        <p className="text-[11px] font-bold text-gray-600 mb-2 text-center">주간 루틴 완료율 (이번 주)</p>
        <WeekdayRoutineBars days={weeklyRoutine} />
      </div>

      {/* 크레딧 숫자·주간 상세 수치는 시트에서 확인 */}
      <ParentAgentBottomSheet
        open={creditDrillOpen}
        title="크레딧·저축 상세"
        onClose={() => setCreditDrillOpen(false)}
        footer={
          <button
            type="button"
            onClick={() => setCreditDrillOpen(false)}
            className="w-full rounded-xl bg-[#4A90E2] py-3 text-xs font-black text-white active:scale-[0.99]"
          >
            닫기
          </button>
        }
      >
        <ul className="space-y-3 text-xs text-gray-800">
          <li className="flex justify-between gap-3 border-b border-gray-100 pb-2">
            <span className="font-bold text-gray-600">14일간 획득 크레딧</span>
            <span className="tabular-nums font-black text-[#4A90E2]">
              {(drill?.credits_earned_14d ?? 0).toLocaleString()}
            </span>
          </li>
          <li className="flex justify-between gap-3 border-b border-gray-100 pb-2">
            <span className="font-bold text-gray-600">저금통으로 들어온 이체 합</span>
            <span className="tabular-nums font-black text-gray-900">
              {(drill?.piggy_transfer_total ?? 0).toLocaleString()}
            </span>
          </li>
          <li className="flex justify-between gap-3 border-b border-gray-100 pb-2">
            <span className="font-bold text-gray-600">지갑 나간 이체 + 구매 합</span>
            <span className="tabular-nums font-black text-gray-900">
              {(drill?.wallet_transfer_and_purchase_total ?? 0).toLocaleString()}
            </span>
          </li>
          <li className="flex justify-between gap-3 pb-1">
            <span className="font-bold text-gray-600">저축률 (지갑+저금통 중 저금통)</span>
            <span className="tabular-nums font-black text-emerald-700">{drill?.save_ratio_pct ?? 0}%</span>
          </li>
        </ul>
        <div className="mt-4 rounded-xl bg-sky-50/60 p-3 ring-1 ring-sky-100">
          <EqScoreBars eq={agentRow?.eq_scores as AgentEqScores | null} />
        </div>
      </ParentAgentBottomSheet>

      {delayExplainOpen ? (
        <EqDelayExplainModal
          onClose={() => setDelayExplainOpen(false)}
          childName={childName}
          savingsRate={savingsRate}
        />
      ) : null}
    </section>
  )
}

/**
 * 요일별 막대: 회색 트랙은 100% 높이, 파란 막대는 **아래에서 위로** 차오릅니다.
 */
function WeekdayRoutineBars({ days }: { days: WeeklyRoutineDay[] }) {
  if (!Array.isArray(days) || days.length === 0) {
    return (
      <div className="rounded-lg bg-white/70 px-3 py-4 text-center text-[11px] font-bold text-gray-400">
        이번 주 루틴 데이터가 아직 없어요.
      </div>
    )
  }

  return (
    <div className="flex items-end justify-between gap-1.5 min-h-[7.5rem] px-1">
      {days.map((d) => {
        const h = d.hasMissions ? d.ratePercent : 0
        const title = d.hasMissions
          ? `${d.date} (${d.weekdayShort}): ${d.ratePercent}% 완주`
          : `${d.date} (${d.weekdayShort}): 배정된 미션 없음`
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1 min-w-0" title={title}>
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
          <stop offset="0%" stopColor="#93C5FD" />
          <stop offset="100%" stopColor="#2563EB" />
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
