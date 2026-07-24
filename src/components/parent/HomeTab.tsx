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
 * - 「일정 브리핑」: 서울 기준 오늘부터 6일 후까지(7일) 구간에 들어오는 `calendar_events` + `public_holidays`(노동절·어린이날 등) + 기기 localStorage 일정을 합칩니다.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
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
import { useChildSiblingAvatarNav, type ChildTab } from '@/components/parent/ChildProfileNav'
import { ParentHomeProgressBlock } from '@/components/parent/EconomicEqPanel'
import { PARENT_NEUTRAL_CARD_CLASSNAME } from '@/lib/parentNeutralBlockStyle'
import ParentAgentHomeCards from '@/components/parent/ParentAgentHomeCards'
import CalendarSection, { CalendarEventSheet } from '@/components/parent/CalendarSection'
import { CompactChildProfileCard } from '@/components/parent/CompactChildProfileCard'
import { useParentAgentReport } from '@/hooks/useParentAgentReport'
import { buildPlaceholderCoachingGuide, buildPlaceholderEqDataFeedback } from '@/lib/childEqAiPlaceholders'
import { childGrowthStageLabel, getChildBadge, getChildZone } from '@/constants/childGrowthLevels'
import type { AgentLatestReportRow } from '@/lib/agentApi'
import SpriteImage from '@/components/common/SpriteImage'
import { ICONS } from '@/constants/sprites'
import RoutineAgentSchedulePanel from '@/components/parent/RoutineAgentSchedulePanel'
import RoutineAgentFab from '@/components/parent/RoutineAgentFab'
import { prefetchChildScreenChunkWhenIdle } from '@/lib/prefetchChildScreenChunk'

/**
 * 서버에서 내려온 브리핑용 일정이 현재 선택 자녀에 맞는지 판별합니다.
 * 비개발자: 가족 안에 형제가 둘이면 DB에 각각 다른 일정이 붙습니다. 브리핑은 예전에는 형제 건까지 한 줄에 같이 나왔는데,
 * 캘린더는 선택한 아이 일정만 보여 주므로「브리핑에만 있는 이상한 일정」「눌렀더니 캘린더에는 다른 제목만」같은 괴리가 생겼습니다.
 * 루틴 탭 `CalendarSection` 의 `eventVisibleForSelectedChild` 와 같은 규칙입니다(travel 예외 포함).
 */
function briefingServerEventVisibleForSelectedChild(
  ev: { child_id?: string | null; event_type?: string | null },
  selectedChildId: string | null,
): boolean {
  if (!selectedChildId) return true
  const cid = ev.child_id
  /** null 이면 가족 공통으로 보는 일정(CalendarSection 과 동일) */
  if (cid == null || String(cid).trim() === '') return true
  if (cid === selectedChildId) return true
  if (ev.event_type === 'travel') return true
  return false
}

/**
 * 브리핑에 쓸 「오늘~오늘+6일(포함 7일)」 구간과 일정 행이 겹치는지 봅니다.
 * 비개발자: 하루짜리 공휴일은 그날만, 긴 방학 같은 일정은 이 주에 걸치는 한 줄로 잡습니다.
 */
function briefingOverlapsSeoulWeekWindow(
  ev: { start_date: string; end_date?: string | null },
  windowStart: string,
  windowEndInclusive: string,
): boolean {
  const start = String(ev.start_date).slice(0, 10)
  const end = String(ev.end_date ?? ev.start_date).slice(0, 10)
  return end >= windowStart && start <= windowEndInclusive
}

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
    end_date: string | null
    routine_override?: string | null
    event_type?: string | null
    title?: string | null
    child_id?: string | null
  }[]
  /** 이번 주(월~일) 중 데일리 미션 기록이 있는 날짜 수(자녀별 서버 계산값). */
  daysWithDataByChild: Record<string, number>
  /** 자녀 id → family_links.id (AI 일정 등록 payload에 사용) */
  familyLinkByChild?: Record<string, string>
}

export default function HomeTab({
  childrenData,
  upcomingEvents,
  daysWithDataByChild,
  familyLinkByChild = {},
}: Props) {
  const { selectedChildId, setSelectedChildId } = useParentStore()
  const searchParams = useSearchParams()
  /** 일정 브리핑 딥링크(`?calendarDate=YYYY-MM-DD`) — 캘린더가 홈으로 이동해 여기서 받습니다 */
  const calendarDateFromQuery = searchParams.get('calendarDate')
  /**
   * `useRef(createClient())`는 **매 렌더마다** `createClient()`가 실행됩니다(JS는 인자를 먼저 계산).
   * Supabase 브라우저 클라이언트가 그때마다 초기화되면 경고·청크 로드 지연을 유발할 수 있어,
   * 첫 렌더에서 한 번만 만드는 ref 패턴을 씁니다.
   */
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  if (supabaseRef.current === null) {
    supabaseRef.current = createClient()
  }

  const currentId = selectedChildId ?? childrenData[0]?.id
  const familyLinkId = currentId ? familyLinkByChild[currentId] ?? null : null
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
  const currentLevel = s?.current_level ?? 0
  const growthZone = getChildZone(currentLevel)
  const growthBadge = getChildBadge(currentLevel)
  const growthStageName = childGrowthStageLabel(currentLevel)
  const growthSummaryLabel = [
    `${growthZone.emoji} ${growthZone.zone}`,
    growthBadge ? `🏅 ${growthBadge.badge}` : null,
  ]
    .filter(Boolean)
    .join(' ')
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
            level_comment: `${child.name}님 · Lv.${currentLevel} ${growthSummaryLabel}\n${buildPlaceholderEqDataFeedback({
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
  /** 홈에서도 루틴 탭과 동일한 도우미 패널 + 미읽음 배지를 제공합니다. */
  const [schedulePanelOpen, setSchedulePanelOpen] = useState(false)
  const [routineAgentUnread, setRoutineAgentUnread] = useState(0)

  useEffect(() => {
    setRoutineAgentUnread(0)
  }, [currentId])
  /**
   * 원인 보정:
   * - 캘린더 탭 등록은 localStorage(`cooanc_calendar_events_v1`) 기반이며,
   *   **브라우저·도메인(호스트)마다 저장소가 완전히 다릅니다.** (localhost ≠ Vercel 주소)
   * - 홈 브리핑은 서버 `calendar_events`도 쓰므로, 이 둘을 **병합**해 한쪽만 쓰면 생기는 괴리를 줄입니다.
   * - 다른 PC/배포 URL에서까지 동일 일정을 보려면 DB에도 쌓이게 하는 별도 동기화가 필요합니다.
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
    /** 로컬 캘린더도 서버 브리핑과 같은 7일(오늘+6) 창으로 맞춥니다 */
    const windowEndInclusive = addSeoulCalendarDays(today, 6)
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
          // 현재 자녀 일정 + `travel` 은 타 자녀 id로만 저장된 가족 일정이 있을 수 있어 캘린더와 동일 예외
          .filter((r) => !r.childId || r.childId === child?.id || r.eventType === 'travel')
          // [오늘~오늘+6일] 과 겹치는 일정 전부 반영 — 건수는 아래 브리핑 병합에서 창 안으로 한 번 더 걸러 정렬만 합니다
          .filter((r) => r.endDate >= today && r.startDate <= windowEndInclusive)
          .sort((a, b) => a.startDate.localeCompare(b.startDate))
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

  /** 부모 홈에 머무는 동안 자녀 앱 JS 청크를 미리 받아 둡니다 */
  useEffect(() => {
    if (!currentId) return
    prefetchChildScreenChunkWhenIdle()
  }, [currentId])

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
    if (!supabase) return

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

  /**
   * 서버 `calendar_events`와 기기 localStorage 일정을 합칩니다(동일 일정은 id·날짜+제목 키로 1개만).
   * 예전: local 이 1건만 있어도 서버 쪽이 전부 버려져, Vercel(로컬 스토리지 비어 있음)과 본의 아니게 달랐습니다.
   */
  const effectiveUpcomingEvents = useMemo(() => {
    type Ev = (typeof localUpcomingEvents)[number]
    const briefingWindowStart = getSeoulDateString()
    const briefingWindowEndInclusive = addSeoulCalendarDays(briefingWindowStart, 6)

    /** 서버 목록은 가족 전체 링크·공휴일 포함이므로 선택 자녀에 맞는 캘린더 행만 남긴 뒤, 브리핑 7일 창 안으로 걸러냅니다 */
    const server = (upcomingEvents ?? []).filter((e) => {
      if (!briefingOverlapsSeoulWeekWindow(e, briefingWindowStart, briefingWindowEndInclusive)) return false
      return briefingServerEventVisibleForSelectedChild(e, currentId ?? null)
    }) as Ev[]

    const local = localUpcomingEvents.filter((e) =>
      briefingOverlapsSeoulWeekWindow(e, briefingWindowStart, briefingWindowEndInclusive),
    )

    /** `end_date` 는 DB에 빈값일 수 있어 `start_date` 로 대체합니다(캘린더 병합과 동일) */
    const keyOf = (e: {
      id?: string
      start_date: string
      end_date: string | null
      title?: string | null
    }) => {
      if (e.id && String(e.id).length >= 8 && !String(e.id).startsWith('__')) return `id:${e.id}`
      const t = (e.title ?? '').trim()
      const end = String(e.end_date ?? e.start_date).slice(0, 10)
      return `r:${e.start_date.slice(0, 10)}|${end}|${t}`
    }
    const map = new Map<string, Ev>()
    for (const e of server) {
      map.set(keyOf(e), e)
    }
    for (const e of local) {
      map.set(keyOf(e), e)
    }

    /** 창 안 전체 노출 — 비정상 대량 저장 대비 여유 한도만 둠 */
    return [...map.values()]
      .sort((a, b) => {
        const c = a.start_date.localeCompare(b.start_date)
        if (c !== 0) return c
        return String(a.title ?? '').localeCompare(String(b.title ?? ''))
      })
      .slice(0, 24)
  }, [localUpcomingEvents, upcomingEvents, currentId])

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
      weekday: '주중 루틴',
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
      return '이번주는 특별한 일정이 없어요.'
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
  /** 다자녀일 때만 — 프로필 카드 속 캐릭터 좌우 ‹ › 에 연결합니다 */
  const siblingNav = useChildSiblingAvatarNav(tabs)

  return (
    /* pb-28: 우하단 플로팅(루틴 도우미) 버튼 높이만큼 하단 여백 — 마지막 내용이 버튼에 가리지 않게 */
    <div className="w-full px-4 md:px-6 lg:px-8 py-4 pb-28 flex flex-col gap-4 md:gap-6">
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

            {/* 좌측(활성): 프로필 · 오늘의 진행도 · 다가오는 일정 · 주간 루틴 */}
            <div className="flex flex-col gap-4">
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
                siblingNav={siblingNav}
                enterChildUi={{
                  childId: child.id,
                  ariaLabel: `${child.name} 자녀용 앱 화면으로 들어가기`,
                  onSelectChild: () => setSelectedChildId(child.id),
                }}
              />

              {/* 한 블록 3단: 오늘의 진행도(도넛) · 주간 루틴 완료율 · 루틴 완주율 */}
              <ParentHomeProgressBlock
                missionRate={missionRate}
                todayCompleted={child.todayCompleted}
                totalMissions={child.totalMissions}
                weeklyRoutine={weeklyRoutine}
              />

              <ParentAgentHomeCards
                agent={effectiveAgentReport}
                daysWithData={selectedDaysWithData}
                calendarNoticeText={calendarNoticeText}
                calendarUpcomingEvents={effectiveUpcomingEvents.map((ev) => ({
                  id: ev.id ?? `${ev.start_date}-${ev.title ?? 'event'}`,
                  date: ev.start_date,
                  dateLabel: formatEventDate(ev.start_date),
                  title: ev.title?.trim() || getCategoryLabel(ev),
                  impactLabel: ev.routine_override === 'none' ? '루틴 없음' : '루틴 조정 필요',
                }))}
                onOpenCalendarEventSheet={() => setCalendarEventSheetOpen(true)}
                showCalendarBriefing
                showAiReport={false}
              />
            </div>

            {/* 우측: 캘린더 (루틴 탭에서 이동, md 에서 sticky) */}
            <div className="md:sticky md:top-4 md:self-start">
              <CalendarSection childId={currentId ?? null} focusDate={calendarDateFromQuery} />
            </div>
          </div>
        </>
      )}
      <RoutineAgentFab
        disabled={!currentId || !familyLinkId}
        unreadCount={routineAgentUnread}
        onClick={() => setSchedulePanelOpen(true)}
      />
      <RoutineAgentSchedulePanel
        open={schedulePanelOpen}
        onClose={() => setSchedulePanelOpen(false)}
        familyLinkId={familyLinkId}
        childId={currentId ?? null}
        onToast={(_msg, _ok, _multiline) => {
          /**
           * 홈 탭에는 기존 루틴 탭처럼 토스트 레이어가 없어서 여기서는 무음 처리합니다.
           * 대신 실패/성공 안내는 패널 내 말풍선·카드에서 보입니다.
           */
        }}
        onAssistantRepliesWhileClosed={(delta) =>
          setRoutineAgentUnread((n) => {
            const next = n + delta
            return next > 999 ? 999 : next
          })
        }
        onPanelOpened={() => setRoutineAgentUnread(0)}
        showRoutineManageEntry={false}
      />
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

