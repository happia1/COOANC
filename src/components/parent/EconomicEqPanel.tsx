'use client'

import { createPortal } from 'react-dom'
import { useEffect, useId, useState } from 'react'
import type { ChildStats } from '@/types/database'
import type { WeeklyRoutineDay } from '@/lib/childWeeklyRoutine'
import ParentAgentHomeCards from '@/components/parent/ParentAgentHomeCards'

/** 차트·피드백에 필요한 `child_stats` 일부만 받습니다(부모 홈 요약 객체와 맞춤). */
export type EconomicEqStatsSlice = Pick<
  ChildStats,
  'eq_routine_rate' | 'eq_delay_score' | 'eq_save_ratio' | 'streak_days' | 'credits'
>

/** 만족 지연 지수 값으로 짧은 코멘트를 만듭니다(모달 「현재 상태」용). 문장 사이는 줄바꿈 한 번만 넣고 빈 줄은 넣지 않습니다. */
function delayScoreReview(score: number, childName: string): string {
  if (score >= 60) {
    return `${childName}의 지표를 보면, 보유 크레딧 중 많은 부분이 저금통에 있어요.\n당장 쓰지 않고 모으는 습관이 잘 보입니다.`
  }
  if (score >= 35) {
    return `저금통 비율이 중간쯤이에요.\n가용(돈바구니)이나 지갑에만 두지 않고 저금통으로 옮기면 같은 총액에서도 이 수치가 함께 올라갑니다.`
  }
  return `아직 가용·지갑 쪽 비중이 크면 수치가 낮게 보일 수 있어요.\n작은 목표부터 저금통으로 옮기는 연습을 보면 좋아요.`
}

/** 소비·저축 비중(저축 %)으로 짧은 코멘트를 만듭니다(모달 「현재 상태」용). */
function saveSpendReview(savePct: number, childName: string): string {
  if (savePct >= 50) {
    return `${childName}의 지표를 보면, 지갑과 저금통을 합친 금액 중 절반 넘게 저금통에 두고 있어요. 저축과 소비의 균형이 좋은 편입니다.`
  }
  if (savePct >= 30) {
    return `저축과 소비가 함께 보이는 구간이에요. 상황에 맞게 저축 비중을 조금씩 키워볼 수 있습니다.`
  }
  return `지금은 지갑(바로 쓸 돈) 비중이 더 큽니다. 구매 전에 일부만 저금통으로 옮겨 보는 것도 습관 형성에 도움이 됩니다.`
}

type EqChartModalKind = 'delay' | 'saveSpend'

type EqChartExplainModalProps = {
  kind: EqChartModalKind
  onClose: () => void
  childName: string
  delayScore: number
  savePct: number
  spendPct: number
}

/**
 * 그래프 카드를 눌렀을 때 뜨는 설명 모달입니다.
 * - 내용: 무엇을 나타내는지, 현재 값 해석, DB 가 쓰는 계산식, 높음/낮음·목표 가이드
 * - `document.body`에 포털로 붙여 부모 레이아웃의 z-index·overflow 에 안 가리게 합니다.
 */
function EqChartExplainModal({
  kind,
  onClose,
  childName,
  delayScore,
  savePct,
  spendPct,
}: EqChartExplainModalProps) {
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

  const title = kind === 'delay' ? '만족 지연 지수' : '소비 vs 저축 비중'

  const body =
    kind === 'delay' ? (
      <div className="space-y-3 text-xs text-gray-700 leading-relaxed">
        <div>
          <p className="font-bold text-gray-900 mb-1">이 그래프는?</p>
          <p>
            전체 보유 크레딧(가용 돈바구니 + 지갑 + 저금통) 중 <strong>저금통에 묶인 비율</strong>을 0~100%로 보여 줍니다.
            당장 쓰지 않고 나중을 위해 모아 두는 비중을 한눈에 볼 수 있어요.
          </p>
        </div>
        <div>
          <p className="font-bold text-gray-900 mb-1">지금 상태</p>
          <p className="whitespace-pre-line">{delayScoreReview(delayScore, childName)}</p>
        </div>
        <div>
          <p className="font-bold text-gray-900 mb-1">계산 방식</p>
          <p className="tabular-nums">
            만족 지연 지수 = 반올림((저금통 크레딧 ÷ 총 크레딧) × 100), 최대 100%. 서버 함수{' '}
            <code className="rounded bg-gray-100 px-1 text-[10px]">recalculate_eq</code>가 지갑·저금통이 바뀔 때마다
            같은 식으로 다시 계산해요.
          </p>
        </div>
        <div>
          <p className="font-bold text-gray-900 mb-1">높으면 좋을까요?</p>
          <p>
            일반적으로 <strong>높을수록</strong> &quot;나중에 쓰기&quot;·만족 지연 습관이 잘 잡혀 있다고 볼 수 있어요.
            다만 미션 보상이 가용(돈바구니)에만 쌓이고 저금통으로 옮기지 않으면 총액은 많은데 수치는 낮게 나올 수 있습니다.
          </p>
        </div>
        <div>
          <p className="font-bold text-gray-900 mb-1">목표는?</p>
          <p>
            연령·성장 단계마다 앱에서 기대하는 구간이 달라질 수 있어요(예: 단계별로 30%, 50% 이상 등).
            한 번에 목표를 올리기보다, <strong>저금통으로 조금씩 옮기는 습관</strong>을 만드는 것이 실천에 가깝습니다.
          </p>
        </div>
      </div>
    ) : (
      <div className="space-y-3 text-xs text-gray-700 leading-relaxed">
        <div>
          <p className="font-bold text-gray-900 mb-1">이 그래프는?</p>
          <p>
            <strong>지갑(바로 쓸 돈)</strong>과 <strong>저금통(모아 둔 돈)</strong>만 놓고, 저축이 차지하는 비율을
            도넛으로 보여 줍니다. 아직 어디에 둘지 정하지 않은 가용(돈바구니) 크레딧은 &quot;결정 전&quot;이라 이 비교의
            분모에 넣지 않아요.
          </p>
        </div>
        <div>
          <p className="font-bold text-gray-900 mb-1">지금 상태</p>
          <p>
            {saveSpendReview(savePct, childName)} (현재: 저축 {savePct}%, 소비 {spendPct}%)
          </p>
        </div>
        <div>
          <p className="font-bold text-gray-900 mb-1">계산 방식</p>
          <p className="tabular-nums">
            저축 비중 = 반올림((저금통 ÷ (지갑 + 저금통)) × 100), 최대 100%. 지갑+저금통 합이 0이면 0%로 둡니다. 화면의
            소비 %는 100 − 저축 %예요. 역시 <code className="rounded bg-gray-100 px-1 text-[10px]">recalculate_eq</code>
            가 갱신합니다.
          </p>
        </div>
        <div>
          <p className="font-bold text-gray-900 mb-1">높으면 좋을까요?</p>
          <p>
            저축 비중이 <strong>너무 낮지만 않으면</strong> 좋고, 반대로 100% 저축만 있는 것도 현실적으로 어려울 수 있어요.
            지갑에 쓸 돈과 저금통에 모을 돈이 <strong>함께</strong> 있는 상태가 균형에 가깝습니다.
          </p>
        </div>
        <div>
          <p className="font-bold text-gray-900 mb-1">비율은 어느 정도?</p>
          <p>
            성장 단계에 따라 &quot;저축 비중 ○% 이상&quot; 같은 기준이 달라질 수 있어요(문서 기준 예: 고단계에서 저축 비중
            30% 이상 등). 아이 상황에 맞게, 지나친 소비보다는 <strong>저축 습관이 자연스럽게 쌓이게</strong> 하는 것을
            목표로 두면 됩니다.
          </p>
        </div>
      </div>
    )

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/45 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="eq-chart-modal-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="닫기" onClick={onClose} />
      <div className="relative z-[1] flex max-h-[min(88dvh,32rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/[0.06] sm:rounded-3xl">
        <div className="shrink-0 border-b border-gray-100 px-4 py-3">
          <h2 id="eq-chart-modal-title" className="text-center text-sm font-bold text-gray-900">
            {title}
          </h2>
          <p className="mt-0.5 text-center text-[10px] text-gray-500">자세한 설명 · 계산 · 해석</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{body}</div>
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

type Props = {
  stats: EconomicEqStatsSlice
  /** 서버에서 미리 계산한 이번 주(월~일) 루틴 완주율 */
  weeklyRoutine: WeeklyRoutineDay[]
  childName: string
  /** 선택된 자녀 id — 있으면 Railway 에이전트 카드(`/agent-a/latest`)를 띄웁니다. */
  agentChildId?: string | null
}

/**
 * 부모 홈 「우리아이 경제 EQ 지수」 카드
 *
 * - **순서**: 에이전트 카드(리포트·코칭) → 「우리아이 경제 EQ 지수」차트 묶음
 * - 만족 지연(반원) + 소비/저축(도넛)은 **한 줄 두 칸**, 그 아래 요일별 막대
 * - **데이터**: `eq_delay_score`·`eq_save_ratio` 는 DB 의 `recalculate_eq()` 가
 *   `child_stats`(지갑·저금통·총액)와 `mission_logs` 로 채웁니다. 돈바구니(가용)=총액−지갑−저금통 은 도넛 분모에 넣지 않습니다.
 */
export default function EconomicEqPanel({
  stats,
  weeklyRoutine,
  childName,
  agentChildId,
}: Props) {
  const gradId = useId().replace(/:/g, '')
  /** 어떤 그래프 설명 모달을 열었는지 — null 이면 닫힘 */
  const [eqChartModal, setEqChartModal] = useState<EqChartModalKind | null>(null)

  // eq_save_ratio: 지갑+저금통 중 저금통 비중(0~100). 소비(파랑)=지갑, 저축(노랑)=저금통.
  const savePct = Math.min(100, Math.max(0, stats.eq_save_ratio))
  const spendPct = 100 - savePct

  return (
    <section className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
      {agentChildId ? <ParentAgentHomeCards childId={agentChildId} /> : null}

      <p className="text-sm font-bold text-gray-700">우리아이 경제 EQ 지수</p>

      <div className="flex flex-col gap-5">
        {/* 만족 지연 + 소비/저축: 한 줄에 좌·우 두 블록 */}
        <div className="grid grid-cols-2 gap-2">
          {/* 카드 전체를 버튼으로 두어 탭·스크린 리더에서도 「설명 열기」가 분명합니다 */}
          <button
            type="button"
            onClick={() => setEqChartModal('delay')}
            className="rounded-xl bg-gray-50/80 px-2 py-2.5 flex flex-col min-w-0 text-left cursor-pointer transition-transform active:scale-[0.99] ring-0 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
            aria-haspopup="dialog"
            aria-label="만족 지연 지수 설명 보기"
          >
            <p className="text-[10px] font-bold text-gray-600 mb-0.5 text-center leading-tight pointer-events-none">
              만족 지연 지수
            </p>
            <div className="pointer-events-none">
              <DelayHalfGauge value={stats.eq_delay_score} gradientId={`delay-${gradId}`} compact />
            </div>
            <p className="text-center text-[11px] font-bold text-[#4A90E2] tabular-nums -mt-0.5 pointer-events-none">
              {stats.eq_delay_score}%
            </p>
          </button>

          <button
            type="button"
            onClick={() => setEqChartModal('saveSpend')}
            className="rounded-xl bg-gray-50/80 px-2 py-2.5 flex flex-col min-w-0 text-left cursor-pointer transition-transform active:scale-[0.99] ring-0 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
            aria-haspopup="dialog"
            aria-label="소비 vs 저축 비중 설명 보기"
          >
            <p className="text-[10px] font-bold text-gray-600 mb-0.5 text-center leading-tight pointer-events-none">
              소비 vs 저축 비중
            </p>
            <div className="pointer-events-none">
              <SaveSpendDonut savePercent={savePct} spendPercent={spendPct} compact />
            </div>
          </button>
        </div>

        <div className="rounded-xl bg-gray-50/80 px-2 py-3">
          <p className="text-[11px] font-bold text-gray-600 mb-2 text-center">일일 루틴 완주율 (이번 주)</p>
          <WeekdayRoutineBars days={weeklyRoutine} />
        </div>
      </div>

      {eqChartModal ? (
        <EqChartExplainModal
          kind={eqChartModal}
          onClose={() => setEqChartModal(null)}
          childName={childName}
          delayScore={stats.eq_delay_score}
          savePct={savePct}
          spendPct={spendPct}
        />
      ) : null}
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
