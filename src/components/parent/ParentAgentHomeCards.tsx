'use client'

/**
 * 부모 홈 — 에이전트 A 중 **코칭 카드·실행 상태**만 담당합니다.
 * - 주간 리포트 문장·카드 레이아웃은 `EconomicEqPanel` 이 `report_text` JSON 을 파싱해 그립니다.
 * - 이 컴포넌트는 `/agent-a/run` 이 돌아가는 동안의 안내와, 코칭 텍스트 바텀시트만 보여 줍니다.
 */

import { type AgentLatestReportRow, parseAgentReportPayload } from '@/lib/agentApi'
import type { ParentAgentErrorReason, UseParentAgentReportResult } from '@/hooks/useParentAgentReport'
import Link from 'next/link'

/** 에러 원인별로 사용자 문구를 분리해 보여 줍니다. */
function getAgentErrorCopy(reason: ParentAgentErrorReason): { title: string; detail: string } {
  switch (reason) {
    case 'unauthorized':
      return {
        title: '로그인 정보 확인이 필요해요',
        detail: '로그인이 만료되었을 수 있어요. 다시 로그인한 뒤 시도해 주세요.',
      }
    case 'timeout':
      return {
        title: 'AI 응답이 지연되고 있어요',
        detail: '서버가 바쁜 상태예요. 잠시 후 다시 시도해 주세요.',
      }
    case 'service_unavailable':
      return {
        title: 'AI 서버가 잠시 쉬고 있어요',
        detail: '잠깐 후 다시 시도하면 정상 동작할 가능성이 높아요.',
      }
    case 'server_error':
      return {
        title: 'AI 서버 처리 중 오류가 발생했어요',
        detail: '일시적인 서버 오류예요. 다시 시도해 주세요.',
      }
    case 'network':
      return {
        title: '네트워크 연결을 확인해 주세요',
        detail: '인터넷 연결이 불안정하거나 차단되어 요청이 실패했어요.',
      }
    default:
      return {
        title: 'AI 분석 연결 실패',
        detail: '에이전트 서버에 연결할 수 없어요.',
      }
  }
}

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
        (d.parent_guide && d.parent_guide.trim()) ||
        (d.report_body_text && d.report_body_text.trim()),
    )
  return coaching || report
}

type Props = {
  /** `useParentAgentReport` 한 번만 호출한 결과를 넘깁니다. */
  agent: UseParentAgentReportResult
  /** 지난 14일 중 미션 완료 기록이 있는 날짜 수(홈 서버 계산값) */
  daysWithData: number
  /** 홈 서버 조회(calendar_events) 기반 일정 브리핑 문구 */
  calendarNoticeText?: string
  /** 홈 브리핑 UI(일정 있음 상태) 목록 데이터 */
  calendarUpcomingEvents?: {
    id: string
    /** 브리핑 클릭 시 루틴 캘린더의 해당 날짜로 이동할 때 사용합니다. */
    date: string
    dateLabel: string
    title: string
    impactLabel: string
  }[]
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
    <div className="rounded-xl bg-gray-50/80 px-3 py-3">
      {/* Progress bar — days collected / 7 */}
      <div className="mb-3">
        <div className="mb-1 flex justify-between text-xs text-gray-600">
          <span>분석 데이터 누적</span>
          <span>{clampedDays}일 / 7일</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-[#4A90E2] transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Preview of what's coming */}
      <p className="mb-3 text-xs text-gray-500">
        {clampedDays === 0
          ? '미션을 완료할수록 더 정확한 분석이 가능해요.'
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
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 opacity-70"
          >
            <span className="text-xs font-medium text-gray-700">{item.label}</span>
            <span className="ml-auto text-[10px] text-gray-400">준비 중</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ParentAgentHomeCards({
  agent,
  daysWithData,
  calendarNoticeText,
  calendarUpcomingEvents = [],
  onOpenCalendarEventSheet,
}: Props) {
  const { row, loading, runState, errorReason, distinctDays, reload } = agent
  // 핵심: insufficient 응답일 때는 에이전트가 실제 계산한 distinctDays를 우선 표시해야
  // "7일 누적" 오해가 생기지 않습니다.
  const onboardingDays =
    runState === 'insufficient'
      // 에이전트가 계산한 distinctDays가 일시적으로 0이어도,
      // 홈 서버가 계산한 daysWithData를 함께 반영해 "0일 고정" 오판을 줄입니다.
      ? Math.max(0, Number(distinctDays || 0), Number(daysWithData || 0))
      : Math.max(0, Number(daysWithData || 0))


  const hasContent = hasDisplayableAgentContent(row)
  const coachingFull = String(row?.coaching_text ?? '').trim()
  const parsed = parseAgentReportPayload(row?.report_text ?? null)
  const rawCalendarNotice = parsed.kind === 'json' ? String(parsed.data.calendar_notice ?? '').trim() : ''
  const noticeText =
    calendarNoticeText?.trim() ||
    rawCalendarNotice ||
    '이번 주는 특별 일정이 없어요. 루틴에 집중하기 좋은 한 주예요.'
  const blockCardClass = 'w-full rounded-2xl bg-white p-4 shadow-sm'
  const errorCopy = getAgentErrorCopy(errorReason)

  return (
    <div className="w-full space-y-3">
      {/* 일정 코멘트는 경제 EQ 패널이 아닌, AI 리포트 블록 상단에서 항상 보여 줍니다. */}
      <section className={blockCardClass}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-gray-700">일정 브리핑</p>
          <button
            type="button"
            onClick={onOpenCalendarEventSheet}
            className="text-xs font-medium text-[#4A90E2]"
          >
            일정 등록하기
          </button>
        </div>
        {calendarUpcomingEvents.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
            <p className="whitespace-pre-line text-sm text-amber-800">
              {noticeText}
            </p>
          </div>
        ) : (
        <div className="rounded-xl bg-gray-50/80 px-3 py-3">
            {calendarUpcomingEvents.map((event) => (
              <Link
                key={event.id}
                href={`/parent/routine?calendarDate=${encodeURIComponent(event.date)}`}
                className="mb-2 flex items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] last:mb-0"
                aria-label={`${event.dateLabel} ${event.title} 일정 보러가기`}
              >
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-gray-500 ring-1 ring-gray-200">
                  {event.dateLabel}
                </span>
                <span className="text-[11px] font-bold text-gray-700">
                  {event.title}
                </span>
                <span className="ml-auto text-[10px] font-semibold text-gray-500">
                  {event.impactLabel}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className={blockCardClass}>
        <p className="mb-3 text-sm font-bold text-gray-700">AI 리포트</p>
        {loading ? (
          <div className="w-full flex items-center justify-center gap-2 rounded-xl bg-gray-50/80 py-6">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-500" aria-hidden />
            <span className="text-xs font-bold text-gray-600">AI 요약 불러오는 중…</span>
          </div>
        ) : null}

        {!loading && runState === 'generating' ? (
          <div className="w-full flex items-center justify-center gap-2 rounded-xl bg-gray-50/80 py-6">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-500" aria-hidden />
            <span className="text-xs font-bold text-gray-600">AI 리포트 생성 중… (최대 2분)</span>
          </div>
        ) : null}

        {!loading && runState === 'insufficient' ? (
          <AgentOnboardingProgressCard daysWithData={onboardingDays} />
        ) : null}

        {!loading && runState === 'error' ? (
          <div className="w-full rounded-xl bg-gray-50/80 p-4">
            <p className="text-center text-sm font-black text-gray-700">{errorCopy.title}</p>
            <p className="mt-1 text-center text-[11px] font-semibold text-gray-500">{errorCopy.detail}</p>
            <button
              type="button"
              onClick={() => void reload()}
              className="mx-auto mt-3 flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-[11px] font-bold text-gray-600 transition-colors hover:bg-gray-100"
            >
              다시 시도
            </button>
          </div>
        ) : null}

        {!loading && runState === 'idle' && !hasContent ? (
          <AgentOnboardingProgressCard daysWithData={onboardingDays} />
        ) : null}

        {!loading && hasContent && coachingFull ? (
          <div className="w-full rounded-xl border border-gray-100 bg-white p-3 text-sm text-gray-800 shadow-sm">
            <p className="text-xs font-bold text-gray-600">경제 습관 코칭 가이드</p>
            <p className="mt-2 whitespace-pre-wrap text-[12px] font-normal leading-relaxed text-gray-700">
              {coachingFull}
            </p>
          </div>
        ) : null}

        {/* 요청 반영: 성장 코멘트를 코칭 가이드 바로 아래에 배치합니다. */}
        {!loading && parsed.kind === 'json' && parsed.data.level_comment?.trim() ? (
          <div className="w-full rounded-xl border border-gray-100 bg-white p-3 text-sm text-gray-800 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-900">
                성장 분석
              </span>
              <span className="text-xs font-bold text-gray-600">레벨 코멘트</span>
            </div>
            <p className="whitespace-pre-wrap text-[12px] font-normal leading-relaxed text-gray-700">
              {parsed.data.level_comment}
            </p>
          </div>
        ) : null}
      </section>

      {/* 태블릿 가로(md)에서는 아래 3개 블록을 왼쪽 컬럼에 배치합니다. */}
      {!loading && parsed.kind === 'json' ? (
        <section className="hidden space-y-3 md:block lg:hidden">
          {parsed.data.parent_guide?.trim() ? (
            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-100/80">
              <p className="text-[10px] font-bold text-amber-800/90 mb-1">부모 가이드</p>
              <p className="leading-relaxed whitespace-pre-wrap">{parsed.data.parent_guide}</p>
            </div>
          ) : null}
        </section>
      ) : null}

    </div>
  )
}
