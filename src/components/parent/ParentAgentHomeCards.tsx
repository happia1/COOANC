'use client'

/**
 * 부모 홈 — 에이전트 A 중 **코칭 카드·실행 상태**만 담당합니다.
 * - 주간 리포트 문장·카드 레이아웃은 `EconomicEqPanel` 이 `report_text` JSON 을 파싱해 그립니다.
 * - 이 컴포넌트는 `/agent-a/run` 이 돌아가는 동안의 안내와, 코칭 텍스트 바텀시트만 보여 줍니다.
 */

import Link from 'next/link'
import { useState } from 'react'
import { type AgentEqScores, type AgentLatestReportRow, parseAgentReportPayload } from '@/lib/agentApi'
import type { UseParentAgentReportResult } from '@/hooks/useParentAgentReport'
import ParentAgentBottomSheet from '@/components/parent/ParentAgentBottomSheet'

/** 한 줄 미리보기: 공백을 정리한 뒤 앞부분만 잘라 카드에 넣습니다. */
function previewLine(text: string | null | undefined, max = 30): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return '내용이 아직 없어요'
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

/**
 * EQ 막대: 값의 **크기만** 막대 길이로 보여 주고, 퍼센트 숫자는 메인 대시보드에서 숨깁니다.
 */
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

type SheetKind = 'coaching' | null

/** 리포트 JSON 또는 코칭 텍스트 중 하나라도 있으면 true */
function hasDisplayableAgentContent(row: AgentLatestReportRow | null | undefined): boolean {
  if (!row) return false
  const coaching = String(row.coaching_text ?? '').trim().length > 0
  const p = parseAgentReportPayload(row.report_text)
  if (p.kind === 'legacy') {
    return coaching || p.text.trim().length > 0
  }
  const d = p.data
  // 최신 에이전트 응답에서 개별 섹션 대신 report_body_text 한 덩어리만 내려오는 경우도
  // "표시 가능한 리포트"로 취급해야 부모 홈에서 "리포트 없음" 오판이 나지 않습니다.
  const report =
    Boolean(
      (d.calendar_notice && d.calendar_notice.trim()) ||
        (d.level_comment && d.level_comment.trim()) ||
        (d.routine_comment && d.routine_comment.trim()) ||
        (d.credit_comment && d.credit_comment.trim()) ||
        (d.wishlist_comment && d.wishlist_comment.trim()) ||
        (d.cheer_message && d.cheer_message.trim()) ||
        (d.parent_guide && d.parent_guide.trim()) ||
        (d.report_body_text && d.report_body_text.trim()),
    )
  return coaching || report
}

type Props = {
  /** `useParentAgentReport` 한 번만 호출한 결과를 넘깁니다. */
  agent: UseParentAgentReportResult
  /** 홈탭에서 공용 일정 등록 시트를 열 때 사용합니다. */
  onOpenCalendarEventSheet?: () => void
}

/**
 * 리포트 준비 중 온보딩 카드:
 * - `distinctDays`(최근 14일 중 미션이 있던 서로 다른 날짜 수)를 진행률로 사용합니다.
 * - 기존 "0일/7일" 문구 대신, 부모가 다음 단계를 직관적으로 이해하도록 구성합니다.
 */
function AgentOnboardingProgressCard({ daysWithData }: { daysWithData: number }) {
  const clampedDays = Math.max(0, Math.min(7, Number(daysWithData || 0)))
  const remain = Math.max(0, 7 - clampedDays)
  const progressPercent = Math.min(100, (clampedDays / 7) * 100)
  return (
    <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-5">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <p className="text-sm font-bold text-blue-900">AI 리포트 준비 중이에요</p>
      </div>

      {/* Progress bar — days collected / 7 */}
      <div className="mb-3">
        <div className="mb-1 flex justify-between text-xs text-blue-700">
          <span>미션 수행 기록</span>
          <span>{clampedDays}일 / 7일</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-blue-100">
          <div
            className="h-full rounded-full bg-blue-400 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Preview of what's coming */}
      <p className="mb-3 text-xs text-blue-600">
        {clampedDays === 0
          ? '첫 미션을 완료하면 기록이 쌓이기 시작해요.'
          : remain > 0
            ? `${remain}일 더 진행하면 리포트가 완성돼요!`
            : '리포트를 만들 준비가 끝났어요. 잠시만 기다려 주세요!'}
      </p>

      {/* Teaser cards — what will be shown */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: '루틴 성실도' },
          { label: '저축 습관' },
          { label: '레벨 분석' },
          { label: 'AI 코멘트' },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2 rounded-xl border border-blue-100 bg-white/70 p-3 opacity-50"
          >
            <span className="text-xs font-medium text-blue-800">{item.label}</span>
            <span className="ml-auto text-[10px] text-blue-400">준비 중</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ParentAgentHomeCards({ agent, onOpenCalendarEventSheet }: Props) {
  const { row, loading, runState, distinctDays, reload } = agent
  const [sheet, setSheet] = useState<SheetKind>(null)

  const hasContent = hasDisplayableAgentContent(row)
  const coachingFull = String(row?.coaching_text ?? '').trim()
  const coachingPreview = previewLine(row?.coaching_text)
  const parsed = parseAgentReportPayload(row?.report_text ?? null)
  const rawCalendarNotice = parsed.kind === 'json' ? String(parsed.data.calendar_notice ?? '').trim() : ''
  const calendarNoticeText = rawCalendarNotice || '이번 주는 특별 일정이 없어요. 루틴에 집중하기 좋은 한 주예요.'

  return (
    <div className="w-full space-y-3">
      {/* 일정 코멘트는 경제 EQ 패널이 아닌, AI 리포트 블록 상단에서 항상 보여 줍니다. */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
        <div className="flex items-center justify-between gap-2">
          <p className="whitespace-pre-line text-center text-xs leading-relaxed">{calendarNoticeText}</p>
          <button
            type="button"
            onClick={onOpenCalendarEventSheet}
            className="ml-3 shrink-0 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
          >
            일정 등록하기
          </button>
        </div>
      </div>

      {loading ? (
        <div className="w-full flex items-center justify-center gap-2 rounded-2xl border border-sky-100 bg-white/80 py-6 shadow-sm">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-sky-200 border-t-sky-500" aria-hidden />
          <span className="text-xs font-bold text-sky-800">AI 요약 불러오는 중…</span>
        </div>
      ) : null}

      {!loading && runState === 'generating' ? (
        <div className="w-full flex items-center justify-center gap-2 rounded-2xl border border-violet-100 bg-violet-50/80 py-6 shadow-sm">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-violet-200 border-t-violet-500" aria-hidden />
          <span className="text-xs font-bold text-violet-800">AI 리포트 생성 중… (최대 2분)</span>
        </div>
      ) : null}

      {!loading && runState === 'insufficient' ? (
        <AgentOnboardingProgressCard daysWithData={distinctDays} />
      ) : null}

      {!loading && runState === 'error' ? (
        <div className="w-full rounded-2xl bg-red-50 p-4 shadow-sm ring-1 ring-red-100">
          <p className="text-center text-sm font-black text-red-700">⚠️ AI 분석 연결 실패</p>
          <p className="mt-1 text-center text-[11px] font-semibold text-red-500">에이전트 서버에 연결할 수 없어요.</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="mx-auto mt-3 flex items-center gap-1 rounded-lg bg-red-100 px-3 py-1.5 text-[11px] font-bold text-red-700 active:bg-red-200"
          >
            다시 시도
          </button>
        </div>
      ) : null}

      {!loading && runState === 'idle' && !hasContent ? (
        <AgentOnboardingProgressCard daysWithData={distinctDays} />
      ) : null}

      {!loading && hasContent && coachingFull ? (
        <button
          type="button"
          onClick={() => setSheet('coaching')}
          className="group w-full flex flex-col rounded-2xl bg-gradient-to-br from-sky-100/90 via-indigo-50 to-violet-50 p-4 text-left shadow-md ring-1 ring-sky-100/80 transition active:scale-[0.99]"
        >
          <span className="text-xs font-black text-sky-950">💡 경제 습관 코칭 가이드</span>
          <p className="mt-2 line-clamp-2 text-[11px] font-semibold leading-snug text-sky-900/90">{coachingPreview}</p>
          <span className="mt-3 text-[10px] font-bold text-sky-700/80">탭해서 전체 보기 →</span>
        </button>
      ) : null}

      <ParentAgentBottomSheet
        open={sheet === 'coaching'}
        title="경제 습관 코칭 가이드"
        onClose={() => setSheet(null)}
        footer={
          <Link
            href="/parent/approval#parent-approval-market-rewards"
            className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-sky-400 to-indigo-500 py-3 text-center text-xs font-black text-white shadow-md ring-1 ring-sky-300/50 active:scale-[0.99]"
            onClick={() => setSheet(null)}
          >
            특별 보상 설정하기
          </Link>
        }
      >
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-gray-800">
          {coachingFull || '내용이 없습니다.'}
        </p>
        <div className="mt-4 rounded-xl bg-sky-50/60 p-3 ring-1 ring-sky-100">
          <EqScoreBars eq={row?.eq_scores as AgentEqScores | null} />
        </div>
      </ParentAgentBottomSheet>
    </div>
  )
}
