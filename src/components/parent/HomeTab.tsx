'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParentStore } from '@/store/parentStore'
import ChildSwitcher, { type ChildTab } from '@/components/parent/ChildSwitcher'
import { CompactChildProfileCard } from '@/components/parent/CompactChildProfileCard'
import { AUTH_LOGO_SRC } from '@/constants/branding'

// 하드코딩 AI 한줄 가이드 (추후 실제 AI로 교체)
const AI_HINTS = [
  '오늘도 미션을 잘 해냈어요! 칭찬 한마디 어떠세요? 🌟',
  '경제 습관이 쑥쑥 자라고 있어요! 함께 저금통을 확인해봐요 🐷',
  '루틴을 꾸준히 지키고 있어요. 대단한 우리 아이! 💪',
  '작은 습관이 큰 변화를 만들어요. 오늘 하루도 수고했어요! ✨',
  '미션 달성률이 올라가고 있어요. 오늘도 화이팅! 🎯',
]

export type ChildSummary = {
  id: string
  name: string
  /** 표시용 만 나이(생년월일 우선, 없으면 DB age) */
  age: number | null
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
  parentName: string
  childrenData: ChildSummary[]
  pendingCount: number
}

export default function HomeTab({ parentName, childrenData, pendingCount }: Props) {
  const { selectedChildId, setSelectedChildId } = useParentStore()

  // 초기 자동 선택
  useEffect(() => {
    if (!selectedChildId && childrenData.length > 0) {
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

      {/* 상단 바: 브랜드 로고(큼직하게), 오른쪽 부모 이름 + 설정 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center">
          <Image
            src={AUTH_LOGO_SRC}
            alt="COOANC"
            width={180}
            height={180}
            className="h-auto max-h-[min(180px,42vw)] w-auto max-w-[min(180px,52vw)] rounded-2xl object-contain"
            style={{ height: 'auto' }}
            priority
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-bold text-gray-700">{parentName}</p>
          </div>
          <Link href="/settings" className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
            <span className="text-base">⚙️</span>
          </Link>
        </div>
      </div>

      {/* 자녀 전환 탭 */}
      <ChildSwitcher children={tabs} />

      {/* 승인 대기 배너 */}
      {pendingCount > 0 && (
        <Link
          href="/parent/approval"
          className="flex items-center justify-between bg-amber-50 border-2 border-amber-300 rounded-2xl px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">🛒</span>
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
          <span className="text-6xl">🐣</span>
          <div className="text-center">
            <p className="font-bold text-gray-600">자녀를 등록해주세요</p>
            <Link href="/onboarding" className="text-sm text-[#4A90E2] font-bold underline mt-1 inline-block">
              자녀 등록하기
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* 자녀 현황 카드 — 여백·텍스트 최소화, 가로 배치 + 우측 마스코트 (참고 UI) */}
          <CompactChildProfileCard
            name={child.name}
            age={child.age}
            avatarUrl={child.avatarUrl}
            level={s?.current_level ?? 0}
            credits={s?.credits ?? 0}
            hearts={s?.hearts ?? 0}
            streakDays={s?.streak_days ?? 0}
            mission={{
              ratePercent: missionRate,
              completed: child.todayCompleted,
              total: child.totalMissions,
            }}
          />

          {/* AI 한줄 가이드 */}
          <div className="bg-gradient-to-r from-[#4A90E2]/10 to-[#7ED321]/10 rounded-2xl px-4 py-3 flex items-start gap-2">
            <span className="text-xl flex-shrink-0">🤖</span>
            <div>
              <p className="text-[10px] font-bold text-[#4A90E2] mb-0.5">AI 코칭 가이드</p>
              <p className="text-xs text-gray-700 leading-relaxed">{aiHint}</p>
            </div>
          </div>

          {/* EQ 지수 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-bold text-gray-700 mb-3">📊 경제 EQ 지수</p>
            <div className="flex flex-col gap-2.5">
              <EqBar label="루틴 완주율" value={s?.eq_routine_rate ?? 0} color="bg-[#4A90E2]" />
              <EqBar label="만족 지연" value={s?.eq_delay_score ?? 0} color="bg-[#7ED321]" />
              <EqBar label="저축 비중" value={s?.eq_save_ratio ?? 0} color="bg-[#F8E71C]" />
            </div>
          </div>

          {/* 최근 활동 로그 */}
          {child.recentActivity.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-sm font-bold text-gray-700 mb-3">📋 최근 활동</p>
              <div className="flex flex-col gap-2">
                {child.recentActivity.map((act, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xl flex-shrink-0">{act.missionEmoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-700 truncate">{act.missionTitle}</p>
                      <p className="text-[10px] text-gray-400">{act.completedAt.slice(0, 10)}</p>
                    </div>
                    <span className="text-xs font-bold text-[#4A90E2] flex-shrink-0">+{act.creditEarned}🪙</span>
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
