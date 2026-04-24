'use client'

/**
 * 부모 앱 「홈」 탭 본문입니다.
 * - 위쪽에서 자녀를 바꾸면(◀▶ 또는 스와이프) 아래 카드·통계가 그 아이 기준으로 바뀝니다.
 * - 「우리아이 경제 EQ 지수」패널에는 AI 리포트 카드(JSON)·저축 습관 반원이 있고, 코칭 카드는 우측 열의 `ParentAgentHomeCards` 만 담당합니다(동일 `useParentAgentReport` 데이터).
 * - Realtime 으로 child_stats 를 구독해 부모가 같은 화면에 있을 때 도넛·반원 수치가 바로 따라갑니다.
 * - 미션 완료 시 막대는 daily_missions Realtime 과 동일 패턴입니다.
 * - 프로필 카드를 누르면 그 아이의 「자녀용 앱 화면」(미션·홈 등)으로 들어갑니다(쿠키 설정 후 /home).
 * - 맨 아래 「최근 활동」은 처음엔 접혀 있고, 헤더를 누르면 목록이 펼쳐집니다(루틴 탭 접기와 같은 화살표 동작).
 * - 구매 승인 대기 안내는 홈이 아니라 상단 종(알림·루틴 알람) 시트에서 보여 줍니다.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import ParentEnterChildUiLink from '@/components/parent/ParentEnterChildUiLink'
import { createClient } from '@/lib/supabase/client'
import {
  addSeoulCalendarDays,
  getSeoulDateString,
  getSeoulMondayOfWeekContaining,
} from '@/lib/koreaDate'
import { buildWeeklyRoutineDays, type WeeklyRoutineDay } from '@/lib/childWeeklyRoutine'
import { COOANC_CALENDAR_EVENTS_STORAGE_KEY } from '@/lib/localStorageChildScope'
import { COOANC_CALENDAR_STORAGE_UPDATE_EVENT } from '@/lib/syncAgentEventToLocalCalendar'
import { useParentStore } from '@/store/parentStore'
import ChildProfileNav, { type ChildTab } from '@/components/parent/ChildProfileNav'
import EconomicEqPanel from '@/components/parent/EconomicEqPanel'
import ParentAgentHomeCards from '@/components/parent/ParentAgentHomeCards'
import { CalendarEventSheet } from '@/components/parent/CalendarSection'
import { CompactChildProfileCard } from '@/components/parent/CompactChildProfileCard'
import { useParentAgentReport } from '@/hooks/useParentAgentReport'
import { buildPlaceholderCoachingGuide, buildPlaceholderEqDataFeedback } from '@/lib/childEqAiPlaceholders'
import { CHILD_GROWTH_LEVELS } from '@/constants/childGrowthLevels'
import type { AgentLatestReportRow } from '@/lib/agentApi'
import SpriteImage from '@/components/common/SpriteImage'
import { ICONS } from '@/constants/sprites'

export type ChildSummary = {
  id: string
  name: string
  /** 표시용 만 나이(생년월일 우선, 없으면 DB age) */
  age: number | null
  /** 카드에 표시: 미취학 또는 학령기 */
  ageGroupLabel: string
  /** 카드에 표시: 가정보육·어린이집 등 — 미입력 시 null */
  childcareLabel: string | null
  /** 프로필 사진 URL (없으면 레벨 이모지 아바타) */
  avatarUrl: string | null
  stats: {
    credits: number
    credits_wallet: number
    credits_piggy: number
    hearts: number
    current_level: number
    exp: number
    exp_to_next_level: number
    streak_days: number
    eq_delay_score: number
    eq_routine_rate: number
    eq_save_ratio: number
  } | null
  todayCompleted: number
  totalMissions: number
  recentActivity: {
    missionTitle: string
    missionEmoji: string
    completedAt: string
    creditEarned: number
  }[]
  /** 이번 주(월~일) 루틴 막대 — 서버에서 채우고 Realtime 으로 갱신합니다. */
  weeklyRoutine: WeeklyRoutineDay[]
}

type Props = {
  childrenData: ChildSummary[]
  upcomingEvents: {
    id: string
    start_date: string
    end_date: string
    routine_override?: string | null
    event_type?: string | null
    title?: string | null
  }[]
  /** 지난 14일 중 미션 완료 기록이 있는 날짜 수(자녀별 서버 계산값). */
  daysWithDataByChild: Record<string, number>
}

export default function HomeTab({ childrenData, upcomingEvents, daysWithDataByChild }: Props) {
  const { selectedChildId, setSelectedChildId } = useParentStore()
  /** 부모 홈 데이터는 이벤트성 갱신보다 안정성이 우선이라 일반 조회(fetch)만 사용합니다. */
  const supabaseRef = useRef(createClient())

  const currentId = selectedChildId ?? childrenData[0]?.id
  const child = childrenData.find((c) => c.id === currentId) ?? childrenData[0]
  const selectedDaysWithData = child ? (daysWithDataByChild[child.id] ?? 0) : 0

  const s = child?.stats ?? null

  /**
   * Agent A 최신 행 — 홈 좌측 EQ 패널과 우측 코칭 카드가 같이 씁니다.
   * selectedDaysWithData를 함께 전달해, 서버 distinctDays 지연 시에도 보정 재시도를 가능하게 합니다.
   */
  const agentReport = useParentAgentReport(child?.id, selectedDaysWithData)

  /** 선택 자녀가 바뀌면 서버에서 받은 주간 막대 데이터로 맞춘 뒤, Realtime 으로 최신화합니다. */
  const [weeklyRoutine, setWeeklyRoutine] = useState<WeeklyRoutineDay[]>(child?.weeklyRoutine ?? [])
  const growthStageName =
    CHILD_GROWTH_LEVELS.find((it) => it.level === (s?.current_level ?? 0))?.name ?? '씨앗'
  const shouldUseLocalFallbackReport =
    agentReport.runState === 'insufficient' &&
    selectedDaysWithData >= 7 &&
    !!child &&
    !!s
  /**
   * 런타임 근거:
   * - 로그에서 에이전트 서버가 `insufficient_data(distinctDays=0)`를 반복 반환함이 확인되었습니다.
   * - 하지만 홈 서버 계산 누적일수가 7일 이상이면, 사용자가 "준비 완료인데 카드가 비어 있음"을 겪습니다.
   * => 이 경우에만 로컬 계산 리포트를 합성해 카드 4종을 즉시 노출합니다.
   */
  const localFallbackAgentRow: AgentLatestReportRow | null =
    shouldUseLocalFallbackReport && child && s
      ? {
          id: `fallback-${child.id}`,
          child_id: child.id,
          week_start: getSeoulMondayOfWeekContaining(getSeoulDateString()),
          report_text: JSON.stringify({
            version: 1,
            level_comment: `${child.name}의 현재 성장 단계는 ${growthStageName}이에요.\n${buildPlaceholderEqDataFeedback({
              stats: {
                eq_routine_rate: s.eq_routine_rate ?? 0,
                eq_delay_score: s.eq_delay_score ?? 0,
                eq_save_ratio: s.eq_save_ratio ?? 0,
                streak_days: s.streak_days ?? 0,
                credits: s.credits ?? 0,
              },
              growthStageName,
              childName: child.name,
              weeklyRoutine,
            })}`,
            routine_comment: `루틴 성실도 ${s.eq_routine_rate ?? 0}%를 기준으로 이번 주 패턴을 요약했어요.`,
            credit_comment: `저축 습관 ${s.eq_delay_score ?? 0}%, 저축 비율 ${s.eq_save_ratio ?? 0}%로 분석했어요.`,
            cheer_message: `${child.name}의 꾸준한 시도를 크게 칭찬해 주세요. 작은 성공이 경제 습관을 만듭니다.`,
            parent_guide: buildPlaceholderCoachingGuide({
              stats: {
                eq_routine_rate: s.eq_routine_rate ?? 0,
                eq_delay_score: s.eq_delay_score ?? 0,
                eq_save_ratio: s.eq_save_ratio ?? 0,
                streak_days: s.streak_days ?? 0,
                credits: s.credits ?? 0,
              },
              growthStageName,
              childName: child.name,
              weeklyRoutine,
            }),
            report_body_text: '로컬 폴백 리포트',
          }),
          coaching_text: buildPlaceholderCoachingGuide({
            stats: {
              eq_routine_rate: s.eq_routine_rate ?? 0,
              eq_delay_score: s.eq_delay_score ?? 0,
              eq_save_ratio: s.eq_save_ratio ?? 0,
              streak_days: s.streak_days ?? 0,
              credits: s.credits ?? 0,
            },
            growthStageName,
            childName: child.name,
            weeklyRoutine,
          }),
          eq_scores: {
            routine_completion: s.eq_routine_rate ?? 0,
            delay_satisfaction: s.eq_delay_score ?? 0,
            save_ratio: s.eq_save_ratio ?? 0,
          },
          created_at: new Date().toISOString(),
        }
      : null
  const effectiveAgentReport =
    localFallbackAgentRow && !agentReport.row
      ? { ...agentReport, row: localFallbackAgentRow, runState: 'success' as const }
      : agentReport
  /** 홈에서도 루틴 탭과 같은 일정 등록 시트를 그대로 재사용합니다. */
  const [calendarEventSheetOpen, setCalendarEventSheetOpen] = useState(false)
  /**
   * 원인 보정:
   * - 캘린더 탭 등록은 현재 localStorage(`cooanc_calendar_events_v1`) 기반인데,
   * - 홈 브리핑은 서버 `calendar_events` 조회값을 기본으로 써서 즉시 반영이 누락될 수 있습니다.
   * => 홈에서도 localStorage 일정을 읽어 7일 브리핑 계산에 함께 반영합니다.
   */
  const [localUpcomingEvents, setLocalUpcomingEvents] = useState<
    {
      id?: string
      start_date: string
      end_date: string
      routine_override?: string | null
      event_type?: string | null
      title?: string | null
    }[]
  >([])

  useEffect(() => {
    const today = getSeoulDateString()
    const sevenDaysLater = addSeoulCalendarDays(today, 7)
    const reloadLocalCalendar = () => {
      try {
        const raw = localStorage.getItem(COOANC_CALENDAR_EVENTS_STORAGE_KEY)
        const parsed = raw ? (JSON.parse(raw) as unknown[]) : []
        const rows = Array.isArray(parsed) ? parsed : []
        const filtered = rows
          .map((row) => {
            const r = row as {
              id?: string
              childId?: string | null
              startDate?: string
              endDate?: string
              routineOverride?: string
              eventType?: string
              title?: string
            }
            return {
              id: r.id,
              childId: r.childId ?? null,
              startDate: String(r.startDate ?? ''),
              endDate: String(r.endDate ?? ''),
              routineOverride: String(r.routineOverride ?? ''),
              eventType: r.eventType ?? null,
              title: r.title ?? null,
            }
          })
          // 현재 선택 자녀 또는 전체(childId=null) 일정만 홈 브리핑에 반영
          .filter((r) => !r.childId || r.childId === child?.id)
          // [오늘~+7일]과 겹치는 일정만 반영
          .filter((r) => r.endDate >= today && r.startDate <= sevenDaysLater)
          .sort((a, b) => a.startDate.localeCompare(b.startDate))
          .slice(0, 5)
          .map((r) => ({
            id: r.id,
            start_date: r.startDate,
            end_date: r.endDate,
            routine_override: r.routineOverride,
            event_type: r.eventType ?? null,
            title: r.title,
          }))
        setLocalUpcomingEvents(filtered)
      } catch {
        setLocalUpcomingEvents([])
      }
    }

    reloadLocalCalendar()
    window.addEventListener(COOANC_CALENDAR_STORAGE_UPDATE_EVENT, reloadLocalCalendar)
    window.addEventListener('storage', reloadLocalCalendar)
    return () => {
      window.removeEventListener(COOANC_CALENDAR_STORAGE_UPDATE_EVENT, reloadLocalCalendar)
      window.removeEventListener('storage', reloadLocalCalendar)
    }
  }, [child?.id])

  // 자녀 목록이 바뀌면(삭제 등) 선택 id 가 없거나 목록에 없으면 첫 자녀로 맞춤
  useEffect(() => {
    if (childrenData.length === 0) {
      setSelectedChildId(null)
      return
    }
    const stillThere = selectedChildId && childrenData.some((c) => c.id === selectedChildId)
    if (!stillThere) {
      setSelectedChildId(childrenData[0].id)
    }
  }, [childrenData, selectedChildId, setSelectedChildId])

  useEffect(() => {
    if (!child) {
      setWeeklyRoutine([])
      return
    }
    setWeeklyRoutine(child.weeklyRoutine)
  }, [child?.id, child?.weeklyRoutine])

  useEffect(() => {
    if (!child) return

    const supabase = supabaseRef.current

    const loadWeek = async () => {
      const today = getSeoulDateString()
      const weekStart = getSeoulMondayOfWeekContaining(today)
      const weekEnd = addSeoulCalendarDays(weekStart, 6)
      const { data, error } = await supabase
        .from('daily_missions')
        .select('date, is_completed')
        .eq('child_id', child.id)
        .gte('date', weekStart)
        .lte('date', weekEnd)

      if (error) {
        console.error('[parent home] weekly routine:', error.message)
        return
      }
      setWeeklyRoutine(buildWeeklyRoutineDays(today, data ?? []))
    }
    /** Realtime 대신 자녀 전환 시 1회 조회로만 최신 주간 막대를 맞춥니다. */
    void loadWeek()
    return
  }, [child?.id])

  // 오늘 미션 달성률
  const missionRate = child?.totalMissions > 0
    ? Math.round((child.todayCompleted / child.totalMissions) * 100)
    : 0

  const effectiveUpcomingEvents = useMemo(() => {
    // localStorage 일정이 있으면 우선 사용(캘린더 등록 직후 즉시 반영 목적)
    if (localUpcomingEvents.length > 0) return localUpcomingEvents
    return upcomingEvents ?? []
  }, [localUpcomingEvents, upcomingEvents])

  function formatEventDate(dateStr: string): string {
    const parts = dateStr.split('-')
    if (parts.length < 3) return dateStr
    const mm = parts[1]
    const dd = parts[2]
    const date = new Date(dateStr)
    const days = ['일', '월', '화', '수', '목', '금', '토']
    return `${mm}/${dd} (${days[date.getDay()]})`
  }

  function getCategoryLabel(event: {
    routine_override?: string | null
    event_type?: string | null
  }): string {
    const routineMap: Record<string, string> = {
      none: '공휴일',
      weekend: '방학·특별일정',
    }
    const eventMap: Record<string, string> = {
      holiday: '공휴일',
      vacation: '방학',
      travel: '여행',
      event: '행사',
      special: '기념일',
      birthday: '기념일',
      etc: '특별 일정',
      other: '특별 일정',
    }
    if (event.routine_override && routineMap[event.routine_override]) {
      return routineMap[event.routine_override]
    }
    if (event.event_type && eventMap[event.event_type]) {
      return eventMap[event.event_type]
    }
    return '특별 일정'
  }

  const calendarNoticeText = useMemo(() => {
    if (!effectiveUpcomingEvents || effectiveUpcomingEvents.length === 0) {
      return '이번 주는 특별 일정이 없어요. 루틴에 집중하기 좋은 한 주예요.'
    }
    const next = effectiveUpcomingEvents[0]
    const label =
      next.title?.trim() ||
      getCategoryLabel(next)
    const dateStr = next.start_date.slice(5).replace('-', '/')
    if (effectiveUpcomingEvents.length === 1) {
      return `이번 주 ${dateStr}에 ${label}이 있어요. 루틴 조정이 필요할 수 있어요.`
    }
    return `이번 주 ${dateStr} 외 ${effectiveUpcomingEvents.length - 1}개 일정이 있어요.`
  }, [effectiveUpcomingEvents])

  const tabs: ChildTab[] = childrenData.map((c) => ({ id: c.id, name: c.name }))

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-4 flex flex-col gap-4 md:gap-6">
      {/* 자녀 전환: ◀ ▶ 및 스와이프 (Zustand 로 루틴 탭과 동일한 자녀 선택) */}
      <ChildProfileNav tabs={tabs} />

      {!child ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="text-center">
            <p className="font-bold text-gray-600">자녀를 등록해주세요</p>
            <Link href="/onboarding" className="text-sm text-[#4A90E2] font-bold underline mt-1 inline-block">
              자녀 등록하기
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* ── 본문: md에서 2컬럼 그리드, 모바일에서 단일 컬럼 ───────────── */}
          <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">

            {/* 좌 컬럼: 프로필 바 + 모바일 진행도 + AI 상태/코칭 카드 */}
            <div className="flex flex-col gap-4">
              {/* ── 상단: 통합 프로필 바 (아바타+이름 좌 / 코인·하트·연속 우) ── */}
              <ParentEnterChildUiLink
                childId={child.id}
                className="block w-full cursor-pointer rounded-2xl transition-opacity active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
                aria-label={`${child.name} 자녀용 앱 화면으로 들어가기`}
                onClick={() => setSelectedChildId(child.id)}
              >
                {/**
                 * 설정 탭과 동일한 자녀 프로필 카드 레이아웃을 재사용합니다.
                 * - 이름 오른쪽: Lv.숫자
                 * - 아래 줄: 미취학·유치원·3세 같은 메타 정보
                 * - 오른쪽 끝: 크레딧·하트·연속일수 통계는 그대로 유지
                 */}
                <CompactChildProfileCard
                  name={child.name}
                  age={child.age}
                  avatarUrl={child.avatarUrl}
                  level={s?.current_level ?? 0}
                  credits={s?.credits ?? 0}
                  hearts={s?.hearts ?? 0}
                  streakDays={s?.streak_days ?? 0}
                  ageGroupLabel={child.ageGroupLabel}
                  childcareLabel={child.childcareLabel}
                />
              </ParentEnterChildUiLink>

              {/* 모바일 전용: 자녀 프로필 바로 아래에 오늘의 진행도를 배치합니다. */}
              <div className="rounded-2xl bg-white p-4 shadow-sm md:hidden">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-gray-700">오늘의 진행도</p>
                  <span className="text-sm font-black tabular-nums text-[#4A90E2]">
                    {missionRate}%
                    <span className="ml-1 text-[10px] font-normal text-gray-400">
                      ({child.todayCompleted}/{child.totalMissions})
                    </span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#93C5FD] to-[#2563EB] transition-all"
                    style={{ width: `${missionRate}%` }}
                  />
                </div>
                {missionRate === 100 && child.totalMissions > 0 && (
                  <p className="mt-1 text-right text-[10px] font-bold text-[#2563EB]">오늘 미션 모두 완료!</p>
                )}
              </div>

              {/**
               * 요청 반영: "데이터 모으는 중" 카드가 포함된 AI 블록을 좌측으로 이동합니다.
               * (`ParentAgentHomeCards`는 로딩/insufficient/코칭 상태를 공통으로 담당)
               */}
              <ParentAgentHomeCards
                agent={effectiveAgentReport}
                daysWithData={selectedDaysWithData}
                calendarNoticeText={calendarNoticeText}
                calendarUpcomingEvents={effectiveUpcomingEvents.map((ev) => ({
                  id: ev.id ?? `${ev.start_date}-${ev.title ?? 'event'}`,
                  // 홈 브리핑 항목 클릭 시 루틴 캘린더에서 이 날짜를 바로 열기 위한 원본 값입니다.
                  date: ev.start_date,
                  dateLabel: formatEventDate(ev.start_date),
                  title: ev.title?.trim() || getCategoryLabel(ev),
                  impactLabel:
                    ev.routine_override === 'none' ? '루틴 없음' : '루틴 조정 필요',
                }))}
                onOpenCalendarEventSheet={() => setCalendarEventSheetOpen(true)}
              />

            </div>

            {/* 우 컬럼: 오늘의 진행도 + 우리아이 경제 EQ 지수 */}
            <div className="flex flex-col gap-4">
              {/* md 이상: 기존 위치(우 컬럼 상단)에 오늘의 진행도를 유지합니다. */}
              <div className="hidden rounded-2xl bg-white p-4 shadow-sm md:block">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-gray-700">오늘의 진행도</p>
                  <span className="text-sm font-black tabular-nums text-[#4A90E2]">
                    {missionRate}%
                    <span className="ml-1 text-[10px] font-normal text-gray-400">
                      ({child.todayCompleted}/{child.totalMissions})
                    </span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#93C5FD] to-[#2563EB] transition-all"
                    style={{ width: `${missionRate}%` }}
                  />
                </div>
                {missionRate === 100 && child.totalMissions > 0 && (
                  <p className="mt-1 text-right text-[10px] font-bold text-[#2563EB]">오늘 미션 모두 완료!</p>
                )}
              </div>

              {/**
               * 요청 반영: "우리아이 경제 EQ 지수" 패널을 우측 컬럼으로 이동합니다.
               */}
              <EconomicEqPanel
                stats={{
                  eq_routine_rate: s?.eq_routine_rate ?? 0,
                  eq_delay_score: s?.eq_delay_score ?? 0,
                  eq_save_ratio: s?.eq_save_ratio ?? 0,
                  streak_days: s?.streak_days ?? 0,
                  credits: s?.credits ?? 0,
                  credits_wallet: s?.credits_wallet ?? 0,
                  credits_piggy: s?.credits_piggy ?? 0,
                  current_level: s?.current_level ?? 0,
                }}
                weeklyRoutine={weeklyRoutine}
                childName={child.name}
                agentChildId={child.id}
                agentRow={effectiveAgentReport.row}
                agentLoading={effectiveAgentReport.loading}
              />
            </div>
          </div>
        </>
      )}
      {child && calendarEventSheetOpen ? (
        <CalendarEventSheet
          initialStartDate={getSeoulDateString()}
          initialEndDate={getSeoulDateString()}
          childId={child.id}
          onSave={(ev) => {
            try {
              const raw = localStorage.getItem(COOANC_CALENDAR_EVENTS_STORAGE_KEY)
              const prev = raw ? (JSON.parse(raw) as unknown[]) : []
              const safePrev = Array.isArray(prev) ? prev : []
              localStorage.setItem(COOANC_CALENDAR_EVENTS_STORAGE_KEY, JSON.stringify([...safePrev, ev]))
            } catch {
              // 홈탭에서 저장 실패해도 앱이 멈추지 않게 방어합니다.
            }
          }}
          onClose={() => setCalendarEventSheetOpen(false)}
        />
      ) : null}
    </div>
  )
}

