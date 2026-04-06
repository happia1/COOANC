'use client'

/**
 * 부모 앱 「홈」 탭 본문입니다.
 * - 위쪽에서 자녀를 바꾸면(◀▶ 또는 스와이프) 아래 카드·통계가 그 아이 기준으로 바뀝니다.
 * - 프로필 카드를 누르면 그 아이의 「자녀용 앱 화면」(미션·홈 등)으로 들어갑니다(쿠키 설정 후 /home).
 */

import { useEffect } from 'react'
import Link from 'next/link'
import { useParentStore } from '@/store/parentStore'
import ChildProfileNav, { type ChildTab } from '@/components/parent/ChildProfileNav'
import { CompactChildProfileCard } from '@/components/parent/CompactChildProfileCard'

// 하드코딩 AI 한줄 가이드 (추후 실제 AI로 교체) — 문장만 두고 장식 이모지는 쓰지 않음
const AI_HINTS = [
  '오늘도 미션을 잘 해냈어요! 칭찬 한마디 어떠세요?',
  '경제 습관이 쑥쑥 자라고 있어요. 함께 저금통을 확인해봐요.',
  '루틴을 꾸준히 지키고 있어요. 대단한 우리 아이!',
  '작은 습관이 큰 변화를 만들어요. 오늘 하루도 수고했어요.',
  '미션 달성률이 올라가고 있어요. 오늘도 화이팅!',
]

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
}

type Props = {
  childrenData: ChildSummary[]
  pendingCount: number
}

export default function HomeTab({ childrenData, pendingCount }: Props) {
  const { selectedChildId, setSelectedChildId } = useParentStore()

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

  const currentId = selectedChildId ?? childrenData[0]?.id
  const child = childrenData.find((c) => c.id === currentId) ?? childrenData[0]
  const s = child?.stats

  // 오늘 미션 달성률
  const missionRate = child?.totalMissions > 0
    ? Math.round((child.todayCompleted / child.totalMissions) * 100)
    : 0

  // AI 힌트 — 요일 기반으로 고정
  const aiHint = AI_HINTS[new Date().getDay() % AI_HINTS.length]

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

          {/* AI 한줄 가이드 — 아이콘 없이 텍스트만 */}
          <div className="bg-gradient-to-r from-[#4A90E2]/10 to-[#7ED321]/10 rounded-2xl px-4 py-3">
            <p className="text-[10px] font-bold text-[#4A90E2] mb-0.5">AI 코칭 가이드</p>
            <p className="text-xs text-gray-700 leading-relaxed">{aiHint}</p>
          </div>

          {/* EQ 지수 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-bold text-gray-700 mb-3">경제 EQ 지수</p>
            <div className="flex flex-col gap-2.5">
              <EqBar label="루틴 완주율" value={s?.eq_routine_rate ?? 0} color="bg-[#4A90E2]" />
              <EqBar label="만족 지연" value={s?.eq_delay_score ?? 0} color="bg-[#7ED321]" />
              <EqBar label="저축 비중" value={s?.eq_save_ratio ?? 0} color="bg-[#F8E71C]" />
            </div>
          </div>

          {/* 최근 활동 로그 */}
          {child.recentActivity.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-sm font-bold text-gray-700 mb-3">최근 활동</p>
              <div className="flex flex-col gap-2">
                {child.recentActivity.map((act, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-black text-gray-600">
                      {act.missionTitle.slice(0, 1)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-700 truncate">{act.missionTitle}</p>
                      <p className="text-[10px] text-gray-400">{act.completedAt.slice(0, 10)}</p>
                    </div>
                    <span className="text-xs font-bold text-[#4A90E2] flex-shrink-0">+{act.creditEarned}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function EqBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-xs font-bold text-gray-600">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}
