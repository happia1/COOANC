'use client'

/**
 * 부모 앱 「홈」 탭 본문입니다.
 * - 위쪽에서 자녀를 바꾸면(◀▶ 또는 스와이프) 아래 카드·통계가 그 아이 기준으로 바뀝니다.
 * - 「우리아이 경제 EQ 지수」패널 안에서는 AI 피드백이 위, 차트·코칭이 아래 순서입니다. 미션 완료 시 막대가 갱신됩니다.
 * - 프로필 카드를 누르면 그 아이의 「자녀용 앱 화면」(미션·홈 등)으로 들어갑니다(쿠키 설정 후 /home).
 * - 맨 아래 「최근 활동」은 처음엔 접혀 있고, 헤더를 누르면 목록이 펼쳐집니다(루틴 탭 접기와 같은 화살표 동작).
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  addSeoulCalendarDays,
  getSeoulDateString,
  getSeoulMondayOfWeekContaining,
} from '@/lib/koreaDate'
import { buildWeeklyRoutineDays, type WeeklyRoutineDay } from '@/lib/childWeeklyRoutine'
import { useParentStore } from '@/store/parentStore'
import ChildProfileNav, { type ChildTab } from '@/components/parent/ChildProfileNav'
import { CompactChildProfileCard } from '@/components/parent/CompactChildProfileCard'
import EconomicEqPanel from '@/components/parent/EconomicEqPanel'

/** 자녀 레벨 번호 → 성장 단계 한글명(EQ 코칭 문구·차트 설명에 사용) */
const LEVELS = [
  { level: 0, name: '씨앗' },
  { level: 1, name: '새싹' },
  { level: 2, name: '교환사' },
  { level: 3, name: '저축왕' },
  { level: 4, name: '나눔이' },
  { level: 5, name: '투자가' },
] as const

/**
 * 최근 활동 카드 헤더용: 펼침이면 화살표가 위(접기), 접힘이면 아래(펼치기) — RoutineTab 의 ChevronToggleIcon 과 동일 패턴입니다.
 */
function RecentActivityChevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={`${className ?? ''} h-4 w-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
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
  pendingCount: number
}

export default function HomeTab({ childrenData, pendingCount }: Props) {
  const { selectedChildId, setSelectedChildId } = useParentStore()

  const currentId = selectedChildId ?? childrenData[0]?.id
  const child = childrenData.find((c) => c.id === currentId) ?? childrenData[0]
  const s = child?.stats

  /** 선택 자녀가 바뀌면 서버에서 받은 주간 막대 데이터로 맞춘 뒤, Realtime 으로 최신화합니다. */
  const [weeklyRoutine, setWeeklyRoutine] = useState<WeeklyRoutineDay[]>(child?.weeklyRoutine ?? [])

  /** 하단 「최근 활동」 목록 — 기본 접힘, 헤더 클릭으로만 펼침 */
  const [recentActivityOpen, setRecentActivityOpen] = useState(false)

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

  // 다른 자녀로 바꾸면 최근 활동도 다시 접어 두어 화면이 덜 복잡해 보이게 함
  useEffect(() => {
    setRecentActivityOpen(false)
  }, [child?.id])

  useEffect(() => {
    if (!child) return

    const supabase = createClient()

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

    const dm = supabase
      .channel(`parent_home_dm:${child.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_missions',
          filter: `child_id=eq.${child.id}`,
        },
        () => {
          void loadWeek()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(dm)
    }
  }, [child?.id])

  // 오늘 미션 달성률
  const missionRate = child?.totalMissions > 0
    ? Math.round((child.todayCompleted / child.totalMissions) * 100)
    : 0

  const tabs: ChildTab[] = childrenData.map((c) => ({ id: c.id, name: c.name }))

  return (
    <div className="flex flex-col gap-4">

      {/* 자녀 전환: ◀ ▶ 및 스와이프 (Zustand 로 루틴 탭과 동일한 자녀 선택) */}
      <ChildProfileNav tabs={tabs} />

      {/* 승인 대기 배너 */}
      {pendingCount > 0 && (
        <Link
          href="/parent/approval"
          className="flex items-center justify-between bg-amber-50 border-2 border-amber-300 rounded-2xl px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <div>
              <p className="text-sm font-bold text-amber-700">구매 요청 {pendingCount}건 대기 중</p>
              <p className="text-[11px] text-amber-500">승인 탭에서 확인하세요</p>
            </div>
          </div>
          <span className="text-amber-400 font-bold text-lg">›</span>
        </Link>
      )}

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
          {/*
            프로필 카드를 누르면 API 가 「부모인데 이 자녀 화면을 본다」는 쿠키를 심고 /home 으로 보냅니다.
            자녀가 평소 쓰는 것과 같은 탭(홈·미션·마켓…)이 열리고, 상단에 「부모 보기」가 보입니다.
            부모 홈에서 선택 중인 자녀와 맞추기 위해 클릭 시 Zustand id 도 같이 저장합니다.
          */}
          <Link
            href={`/api/parent/enter-child-ui?childId=${encodeURIComponent(child.id)}`}
            className="block cursor-pointer rounded-xl transition-opacity active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
            aria-label={`${child.name} 자녀용 앱 화면으로 들어가기`}
            onClick={() => setSelectedChildId(child.id)}
          >
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
              mission={{
                ratePercent: missionRate,
                completed: child.todayCompleted,
                total: child.totalMissions,
              }}
            />
          </Link>

          <EconomicEqPanel
            stats={{
              eq_routine_rate: s?.eq_routine_rate ?? 0,
              eq_delay_score: s?.eq_delay_score ?? 0,
              eq_save_ratio: s?.eq_save_ratio ?? 0,
              streak_days: s?.streak_days ?? 0,
              credits: s?.credits ?? 0,
            }}
            weeklyRoutine={weeklyRoutine}
            growthStageName={LEVELS[Math.min(5, Math.max(0, s?.current_level ?? 0))].name}
            childName={child.name}
          />

          {/* 최근 활동: 토글 헤더(기본 접힘) + 펼칠 때만 미션 완료 로그 목록 */}
          {child.recentActivity.length > 0 && (
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setRecentActivityOpen((o) => !o)}
                aria-expanded={recentActivityOpen}
                aria-label={recentActivityOpen ? '최근 활동 접기' : '최근 활동 펼치기'}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 active:bg-gray-50/80"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="text-sm font-bold text-gray-700">최근 활동</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                    {child.recentActivity.length}
                  </span>
                </div>
                <RecentActivityChevron open={recentActivityOpen} className="text-gray-400" />
              </button>
              {recentActivityOpen ? (
                <div className="flex flex-col gap-2 border-t border-gray-100 px-4 pb-4 pt-3">
                  {child.recentActivity.map((act, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-black text-gray-600">
                        {act.missionTitle.slice(0, 1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-gray-700">{act.missionTitle}</p>
                        <p className="text-[10px] text-gray-400">{act.completedAt.slice(0, 10)}</p>
                      </div>
                      <span className="flex-shrink-0 text-xs font-bold text-[#4A90E2]">+{act.creditEarned}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  )
}
