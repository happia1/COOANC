'use client'

/**
 * 부모 앱 「홈」 탭 본문입니다.
 * - 위쪽에서 자녀를 바꾸면(◀▶ 또는 스와이프) 아래 카드·통계가 그 아이 기준으로 바뀝니다.
 * - 「우리아이 경제 EQ 지수」패널 상단에는 Railway AI 에이전트 카드(리포트·코칭)가 있고, 아래 차트는 child_stats 의 eq_* 필드를 씁니다.
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
import { useParentStore } from '@/store/parentStore'
import ChildProfileNav, { type ChildTab } from '@/components/parent/ChildProfileNav'
import EconomicEqPanel from '@/components/parent/EconomicEqPanel'
import ParentAgentHomeCards from '@/components/parent/ParentAgentHomeCards'
import SpriteImage from '@/components/common/SpriteImage'
import { ICONS } from '@/constants/sprites'

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
}

export default function HomeTab({ childrenData }: Props) {
  const { selectedChildId, setSelectedChildId } = useParentStore()
  /** 부모 홈 데이터는 이벤트성 갱신보다 안정성이 우선이라 일반 조회(fetch)만 사용합니다. */
  const supabaseRef = useRef(createClient())

  const currentId = selectedChildId ?? childrenData[0]?.id
  const child = childrenData.find((c) => c.id === currentId) ?? childrenData[0]

  const s = child?.stats ?? null

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

  const tabs: ChildTab[] = childrenData.map((c) => ({ id: c.id, name: c.name }))

  return (
    <div className="flex flex-col gap-4 md:gap-6">
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

            {/* 좌 컬럼: 프로필 바 + 이번 주 성장 리포트(EQ 차트) + 오늘의 진행도 + 주간 루틴 달성 */}
            <div className="flex flex-col gap-4">
              {/* ── 상단: 통합 프로필 바 (아바타+이름 좌 / 코인·하트·연속 우) ── */}
              <ParentEnterChildUiLink
                childId={child.id}
                className="block w-full cursor-pointer rounded-2xl transition-opacity active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
                aria-label={`${child.name} 자녀용 앱 화면으로 들어가기`}
                onClick={() => setSelectedChildId(child.id)}
              >
                <div className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
                  {/* 좌: 아바타 + 이름 + 레벨 */}
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white">
                      {child.avatarUrl ? (
                        <div className="flex h-full w-full items-center justify-center p-1.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={child.avatarUrl} alt="" className="h-full w-full object-contain object-center" />
                        </div>
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-center text-[10px] font-black leading-tight text-gray-700">
                          Lv{s?.current_level ?? 0}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-black text-gray-800">{child.name}</span>
                      <span className="text-[11px] text-gray-400">Lv.{s?.current_level ?? 0}</span>
                    </div>
                  </div>

                  {/* 우: 코인 · 하트 · 연속 */}
                  <div
                    className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-4"
                    aria-label={`코인 ${(s?.credits ?? 0).toLocaleString()}, 하트 ${s?.hearts ?? 0}, 연속 ${s?.streak_days ?? 0}일`}
                  >
                    <div className="flex items-center gap-1">
                      <SpriteImage sheet={ICONS} frame="credits" width={16} clipRotated={false} className="shrink-0 select-none" />
                      <span className="text-sm font-black tabular-nums text-[#4A90E2]">
                        {(s?.credits ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <SpriteImage sheet={ICONS} frame="heart" width={16} className="shrink-0 select-none" />
                      <span className="text-sm font-black tabular-nums text-rose-500">
                        {s?.hearts ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" className="shrink-0 text-orange-500" aria-hidden>
                        <path
                          d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        />
                      </svg>
                      <span className="text-sm font-black tabular-nums text-amber-600">
                        {s?.streak_days ?? 0}일
                      </span>
                    </div>
                  </div>
                </div>
              </ParentEnterChildUiLink>

              <EconomicEqPanel
                stats={{
                  eq_routine_rate: s?.eq_routine_rate ?? 0,
                  eq_delay_score: s?.eq_delay_score ?? 0,
                  eq_save_ratio: s?.eq_save_ratio ?? 0,
                  streak_days: s?.streak_days ?? 0,
                  credits: s?.credits ?? 0,
                }}
                weeklyRoutine={weeklyRoutine}
                childName={child.name}
              />

              {/* 오늘의 진행도 */}
              <div className="rounded-2xl bg-white p-4 shadow-sm">
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
                    className="h-full rounded-full bg-gradient-to-r from-[#F8E71C] to-[#7ED321] transition-all"
                    style={{ width: `${missionRate}%` }}
                  />
                </div>
                {missionRate === 100 && child.totalMissions > 0 && (
                  <p className="mt-1 text-right text-[10px] font-bold text-[#7ED321]">오늘 미션 모두 완료!</p>
                )}
              </div>
            </div>

            {/* 우 컬럼: AI 꿀팁(ParentAgentHomeCards) + 최근 활동 + 데이터 모으는 중
                ParentAgentHomeCards 가 데이터 있을 땐 AI 카드, 없을 땐 「데이터 모으는 중」을 모두 처리함 */}
            <div className="flex flex-col gap-4">
              <ParentAgentHomeCards childId={child.id} />

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
            </div>
          </div>
        </>
      )}
    </div>
  )
}
