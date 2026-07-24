'use client'

/**
 * 부모 홈 — AI 리포트 카드·일정 브리핑·로딩·에러 상태를 담당합니다.
 * - EQ 지수·위시리스트 등은 `EconomicEqPanel` 이 `report_text` JSON 을 파싱해 그립니다.
 * - 경제 습관 코칭 가이드(`coaching_text`)는 홈에서 노출하지 않습니다.
 */

import { useEffect, useState } from 'react'
import { type AgentEqScores, type AgentLatestReportRow, parseAgentReportPayload } from '@/lib/agentApi'
import type { ParentAgentErrorReason, UseParentAgentReportResult } from '@/hooks/useParentAgentReport'
import { createClient } from '@/lib/supabase/client'
import { PARENT_NEUTRAL_CARD_CLASSNAME } from '@/lib/parentNeutralBlockStyle'
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

/** 리포트 JSON(또는 레거시 본문)에 표시할 내용이 있으면 true — 코칭 가이드는 홈에서 제외 */
function hasDisplayableAgentContent(row: AgentLatestReportRow | null | undefined): boolean {
  if (!row) return false
  const p = parseAgentReportPayload(row.report_text)
  if (p.kind === 'legacy') {
    return p.text.trim().length > 0
  }
  const d = p.data
  // 최신 에이전트 응답에서 개별 섹션 대신 report_body_text 한 덩어리만 내려오는 경우도
  // "표시 가능한 리포트"로 취급해야 부모 홈에서 "리포트 없음" 오판이 나지 않습니다.
  return Boolean(
    (d.calendar_notice && d.calendar_notice.trim()) ||
      (d.level_comment && d.level_comment.trim()) ||
      (d.routine_comment && d.routine_comment.trim()) ||
      (d.credit_comment && d.credit_comment.trim()) ||
      (d.wishlist_comment && d.wishlist_comment.trim()) ||
      (d.parent_guide && d.parent_guide.trim()) ||
      (d.report_body_text && d.report_body_text.trim()),
  )
}

type Props = {
  /** `useParentAgentReport` 한 번만 호출한 결과를 넘깁니다. */
  agent: UseParentAgentReportResult
  /** 이번 주(월~일) 중 데일리 미션 기록이 존재하는 날짜 수(홈 서버 계산값) */
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
  /** false 이면 「다가오는 일정」 블록을 숨깁니다(홈 좌측 열에만 둘 때). */
  showCalendarBriefing?: boolean
  /** false 이면 「AI 리포트」 블록을 숨깁니다(홈 우측 비활성 열에만 둘 때). */
  showAiReport?: boolean
}

// ─── 공통 데이터 타입·훅 ─────────────────────────────────────────────────────

type TopMission = { title: string; count: number }

type WeeklyStats = {
  /** 일별 완료율의 평균 (0–100) */
  avgRate: number
  /** 데이터가 있는 날 수 */
  activeDays: number
  /** 스페셜 루틴 달성 상위 5개 */
  topSpecial: TopMission[]
}

type DmRow = {
  date: string
  completed: boolean
  missions: { title: string; difficulty: string; repeat_type: string } | null
}

/**
 * 모듈 레벨 캐시:
 * 같은 자녀·같은 기준일(since) 조합은 한 번 계산한 결과를 재사용해
 * 탭 전환/리렌더 때 `daily_missions` 중복 조회를 줄입니다.
 */
const WEEKLY_STATS_CACHE = new Map<string, WeeklyStats>()

/**
 * 최근 14일 daily_missions 를 한 번만 조회해
 * 루틴 성실도 일별 평균 + 스페셜 루틴 TOP 5 를 동시에 계산합니다.
 */
function useWeeklyStats(childId: string) {
  const [stats, setStats] = useState<WeeklyStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!childId) {
      setLoading(false)
      return
    }

    // 오늘 포함 최근 14일
    const since = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]
    const cacheKey = `${childId}:${since}`

    // 같은 조건으로 이미 계산한 결과가 있으면 DB 조회를 생략합니다.
    const cached = WEEKLY_STATS_CACHE.get(cacheKey)
    if (cached) {
      setStats(cached)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    createClient()
      .from('daily_missions')
      .select('date, completed, missions(title, difficulty, repeat_type)')
      .eq('child_id', childId)
      .gte('date', since)
      .then(({ data }) => {
        if (cancelled) return
        const rows = (data ?? []) as DmRow[]

        // ── 1. 일별 완료율 평균 ────────────────────────────
        const byDate = new Map<string, { total: number; done: number }>()
        rows.forEach((r) => {
          const key = String(r.date)
          const cur = byDate.get(key) ?? { total: 0, done: 0 }
          cur.total += 1
          if (r.completed) cur.done += 1
          byDate.set(key, cur)
        })
        const dailyRates = Array.from(byDate.values()).filter((d) => d.total > 0)
        const avgRate =
          dailyRates.length > 0
            ? Math.round(
                dailyRates.reduce((sum, d) => sum + (d.done / d.total) * 100, 0) /
                  dailyRates.length,
              )
            : 0

        // ── 2. 스페셜 루틴 TOP 5 (difficulty='special', repeat_type='daily') ──
        const specialCounts = new Map<string, number>()
        rows.forEach((r) => {
          if (!r.completed) return
          const m = r.missions
          if (m?.difficulty === 'special' && m?.repeat_type === 'daily') {
            const title = m.title || '알 수 없음'
            specialCounts.set(title, (specialCounts.get(title) ?? 0) + 1)
          }
        })
        const topSpecial = Array.from(specialCounts.entries())
          .map(([title, count]) => ({ title, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)

        const result = { avgRate, activeDays: dailyRates.length, topSpecial }
        WEEKLY_STATS_CACHE.set(cacheKey, result)
        setStats(result)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [childId])

  return { stats, loading }
}

// ─── 루틴 성실도 블록 ────────────────────────────────────────────────────────

function getRoutineTier(pct: number): { label: string; badgeClass: string; desc: string } {
  if (pct >= 80) return { label: '매우 우수', badgeClass: 'bg-emerald-100 text-emerald-700', desc: '미션을 아주 잘 해내고 있어요!' }
  if (pct >= 60) return { label: '우수',     badgeClass: 'bg-blue-100 text-blue-700',     desc: '루틴을 꽤 잘 지키고 있어요' }
  if (pct >= 40) return { label: '보통',     badgeClass: 'bg-amber-100 text-amber-700',   desc: '조금 더 꾸준히 해봐요' }
  if (pct >= 20) return { label: '노력 필요', badgeClass: 'bg-orange-100 text-orange-700', desc: '함께 도전해 보아요!' }
  return              { label: '시작 단계', badgeClass: 'bg-gray-100 text-gray-600',     desc: '미션을 시작해 보아요!' }
}

/**
 * 최근 14일 일별 완료율 평균을 등급·설명과 함께 보여 줍니다.
 * 데이터 축적 일수에 관계 없이 매일 자동 갱신됩니다.
 */
function RoutineSincerityBlock({
  loading,
  avgRate,
  activeDays,
  aiComment,
}: {
  loading: boolean
  avgRate: number
  activeDays: number
  aiComment: string
}) {
  const tier = getRoutineTier(avgRate)
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-bold text-gray-600">루틴 성실도</span>
        {!loading && activeDays > 0 ? (
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${tier.badgeClass}`}>
            {tier.label}
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="flex justify-center py-2">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-400" />
        </div>
      ) : activeDays === 0 ? (
        <p className="text-[10px] text-gray-400">아직 데이터가 없어요</p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-300 to-blue-500 transition-all duration-500"
                style={{ width: `${avgRate}%` }}
              />
            </div>
            <span className="shrink-0 text-xs font-black tabular-nums text-blue-600">{avgRate}%</span>
          </div>
          <p className="text-[10px] font-medium text-gray-500">{tier.desc}</p>
          {aiComment.trim() ? (
            <p className="mt-0.5 border-t border-gray-100 pt-1 line-clamp-3 text-[10px] leading-relaxed text-gray-400">
              {aiComment.trim()}
            </p>
          ) : null}
        </>
      )}

      <p className="text-[9px] text-gray-400">
        최근 14일 일별 평균{activeDays > 0 ? ` (${activeDays}일 기준)` : ''}
      </p>
    </div>
  )
}

// ─── 스페셜 루틴 TOP 5 블록 ──────────────────────────────────────────────────

/**
 * 최근 14일간 달성한 스페셜 루틴(difficulty='special') 상위 5개를 보여 줍니다.
 */
function TopSpecialMissionsBlock({
  loading,
  missions,
}: {
  loading: boolean
  missions: TopMission[]
}) {
  const max = missions[0]?.count ?? 1
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <span className="text-[11px] font-bold text-gray-600">스페셜 루틴 TOP 5</span>

      {loading ? (
        <div className="flex justify-center py-2">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-400" />
        </div>
      ) : missions.length === 0 ? (
        <p className="text-[10px] text-gray-400">최근 14일 스페셜 루틴 기록이 없어요</p>
      ) : (
        <div className="space-y-1.5">
          {missions.map((m, i) => (
            <div key={m.title} className="flex items-center gap-1.5">
              <span className="w-3 shrink-0 text-[9px] font-black tabular-nums text-gray-400">{i + 1}</span>
              <span className="w-[4rem] shrink-0 truncate text-[10px] font-medium text-gray-600">{m.title}</span>
              <div className="flex-1 overflow-hidden rounded-full bg-gray-100 h-1.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-300 to-purple-500 transition-all duration-500"
                  style={{ width: `${Math.round((m.count / max) * 100)}%` }}
                />
              </div>
              <span className="shrink-0 text-[9px] tabular-nums text-gray-400">{m.count}회</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[9px] text-gray-400">최근 14일 기준</p>
    </div>
  )
}

// ─── 루틴 인사이트 그리드 (두 블록 공유 쿼리) ───────────────────────────────

/**
 * 한 번의 Supabase 쿼리로 루틴 성실도 + 스페셜 루틴 TOP 5 데이터를 가져와
 * 두 블록에 나눠서 렌더링합니다.
 */
function RoutineInsightGrid({ childId, aiComment }: { childId: string; aiComment: string }) {
  const { stats, loading } = useWeeklyStats(childId)
  return (
    <div className="grid grid-cols-2 gap-2">
      <RoutineSincerityBlock
        loading={loading}
        avgRate={stats?.avgRate ?? 0}
        activeDays={stats?.activeDays ?? 0}
        aiComment={aiComment}
      />
      <TopSpecialMissionsBlock
        loading={loading}
        missions={stats?.topSpecial ?? []}
      />
    </div>
  )
}

/**
 * 레벨 분석 텍스트에서 첫 줄(중복 도입 멘트)을 삭제하고,
 * 다중 줄 바꿈을 단일 줄 바꿈으로 압축합니다.
 */
function processLevelComment(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  const firstBreak = trimmed.indexOf('\n')
  const withoutFirst = firstBreak !== -1 ? trimmed.slice(firstBreak + 1) : trimmed
  return withoutFirst.replace(/\n{2,}/g, '\n').trim()
}

/** 부모 가이드 본문 전체 — 맨 앞이 「이 단락은」이 아니면 한 번만 붙입니다(줄 단위 분리 없음). */
function formatParentGuideBody(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (/^이 단락은/.test(t)) return t
  return `이 단락은 ${t}`
}

/**
 * 「이 단락은…」으로 시작하는 **예시/도입 문장**과 그 뒤 본문을 나눕니다.
 * - 첫 줄에 줄바꿈이 있으면: 첫 줄 = 예시 톤, 나머지 = 일반 톤
 * - 한 줄이면: 첫 마침표(또는 ! ? 。) 뒤 공백까지 = 예시 톤, 나머지 = 일반 톤
 * - 한 문장뿐이면: 전체를 예시 톤으로만 표시(플레이스홀더 등)
 */
function splitParentGuideExampleLead(formatted: string): { lead: string; rest: string } {
  const t = formatted.trim()
  if (!t.startsWith('이 단락은')) {
    return { lead: '', rest: t }
  }
  const nl = t.indexOf('\n')
  if (nl !== -1) {
    return { lead: t.slice(0, nl).trim(), rest: t.slice(nl + 1).trim() }
  }
  const m = t.match(/^(.+?[.!?。])(\s+)([\s\S]+)$/)
  if (m?.[1] && m[3]) {
    return { lead: m[1].trim(), rest: m[3].trim() }
  }
  return { lead: t, rest: '' }
}

/** 부모 가이드 앰버 박스: 「이 단락은…」 도입은 예시 톤(이탤릭·살짝 흐림), 이후는 본문 톤 — 글자 크기는 레벨 분석 본문과 동일(12px) */
function ParentGuideAmberParagraph({ raw }: { raw: string }) {
  const guideText = formatParentGuideBody(raw)
  const { lead, rest } = splitParentGuideExampleLead(guideText)
  return (
    <p className="whitespace-pre-line text-[12px] font-normal leading-relaxed text-amber-800">
      {lead ? (
        <span className="block font-medium italic text-amber-900/55">
          <span className="sr-only">예시 문구. </span>
          {lead}
        </span>
      ) : null}
      {rest ? (
        <span className="mt-1.5 block whitespace-pre-line font-normal text-amber-800">
          {rest}
        </span>
      ) : null}
    </p>
  )
}

/**
 * 전체 너비 텍스트 카드 — 레벨 분석 등에 사용합니다.
 */
function ReportFullCard({
  label,
  comment,
  badge,
}: {
  label: string
  comment: string
  badge?: string
}) {
  if (!comment.trim()) return null
  return (
    <div className="w-full rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className="mb-1.5 flex items-center gap-1.5">
        {badge ? (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-bold text-violet-700">
            {badge}
          </span>
        ) : null}
        <span className="text-xs font-bold text-gray-600">{label}</span>
      </div>
      <p className="whitespace-pre-wrap text-[12px] font-normal leading-relaxed text-gray-700">
        {comment.trim()}
      </p>
    </div>
  )
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
  showCalendarBriefing = true,
  showAiReport = true,
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
  const parsed = parseAgentReportPayload(row?.report_text ?? null)
  const rawCalendarNotice = parsed.kind === 'json' ? String(parsed.data.calendar_notice ?? '').trim() : ''
  const noticeText =
    calendarNoticeText?.trim() ||
    rawCalendarNotice ||
    '이번주는 특별한 일정이 없어요.'
  const errorCopy = getAgentErrorCopy(errorReason)

  return (
    <div className="w-full space-y-4">
      {showCalendarBriefing ? (
      /* 일정 브리핑 — 홈의 오늘의 진행도·EQ 블록과 동일한 중립 카드(`parentNeutralBlockStyle`) */
      <section className={`w-full ${PARENT_NEUTRAL_CARD_CLASSNAME} px-3 py-3`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-gray-700">다가오는 일정</p>
          <button
            type="button"
            onClick={onOpenCalendarEventSheet}
            className="shrink-0 rounded-lg border border-[#4A90E2]/40 bg-[#4A90E2]/10 px-2.5 py-1 text-[10px] font-bold leading-tight text-[#2563EB] shadow-sm transition active:scale-95 hover:bg-[#4A90E2]/15"
          >
            ＋ 일정 등록하기
          </button>
        </div>
        {calendarUpcomingEvents.length === 0 ? (
          <p className="whitespace-pre-line text-center text-[12px] font-normal leading-relaxed text-gray-500">
            {noticeText}
          </p>
        ) : (
          <div>
            {calendarUpcomingEvents.map((event) => (
              <Link
                key={event.id}
                href={`/parent/home?calendarDate=${encodeURIComponent(event.date)}`}
                className="mb-2 flex items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] last:mb-0"
                aria-label={`${event.dateLabel} ${event.title} 일정 보러가기`}
              >
                <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-bold text-gray-500 ring-1 ring-gray-200">
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
      ) : null}

      {showAiReport && parsed.kind === 'json' && parsed.data.parent_guide?.trim() ? (
      /* 부모 가이드 — 제목 바깥, 본문만 앰버 톤 박스 */
        <section className="w-full">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-gray-700">부모 가이드</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
            <ParentGuideAmberParagraph raw={parsed.data.parent_guide} />
          </div>
        </section>
      ) : null}

      {showAiReport ? (
      <section className="w-full">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="text-sm font-bold text-gray-700">AI 리포트</p>
          {/* success 상태일 때만 날짜 정보를 헤더 우측에 표시합니다. */}
          {!loading && runState === 'success' && hasContent && row?.created_at ? (
            <span className="shrink-0 text-[9px] text-gray-400 tabular-nums">
              {new Date(row.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
              {' → '}
              {new Date(new Date(row.created_at).getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} 갱신
            </span>
          ) : null}
        </div>
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

        {/* ── 리포트 성공 상태: 루틴 성실도 그리드 + 레벨 분석 ── */}
        {!loading && runState === 'success' && hasContent ? (() => {
          const routineComment = parsed.kind === 'json' ? String(parsed.data.routine_comment ?? '') : ''
          const levelComment   = parsed.kind === 'json' ? String(parsed.data.level_comment   ?? '') : ''
          return (
            <div className="space-y-3">
              {/* 루틴 성실도 (7일 일별 평균) + 스페셜 루틴 TOP 5 */}
              <RoutineInsightGrid childId={row?.child_id ?? ''} aiComment={routineComment} />

              <ReportFullCard label="레벨 분석" comment={processLevelComment(levelComment)} badge="성장" />
            </div>
          )
        })() : null}

        {/* 하단 안내: 날짜는 상단 헤더로 이동, 주기 안내만 남깁니다. */}
        {!loading && runState === 'success' && hasContent ? (
          <div className="mt-1 flex items-start gap-1.5 px-1">
            <span className="mt-0.5 shrink-0 text-[10px] text-gray-400">ℹ</span>
            <p className="text-[10px] leading-relaxed text-gray-400">
              최근 14일 미션 활동 기반,{' '}
              <strong className="font-semibold text-gray-500">7일마다 자동 업데이트</strong>
            </p>
          </div>
        ) : null}
      </section>
      ) : null}

    </div>
  )
}
