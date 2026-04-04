'use client'

import { useState } from 'react'
import type { Mission } from '@/types/database'

const DIFFICULTY_LABEL: Record<string, string> = {
  easy:    '쉬움',
  normal:  '보통',
  hard:    '어려움',
  special: '특별',
}
const DIFFICULTY_COLOR: Record<string, string> = {
  easy:    'bg-green-100 text-green-700',
  normal:  'bg-blue-100 text-blue-700',
  hard:    'bg-orange-100 text-orange-700',
  special: 'bg-purple-100 text-purple-700',
}

type Props = {
  childId: string
  missions: Mission[]
  completedIds: string[]
  credits: number
  streak: number
  today: string
}

export default function MissionTab({ childId, missions, completedIds, credits, streak, today }: Props) {
  const [done, setDone] = useState<Set<string>>(new Set(completedIds))
  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function handleComplete(missionId: string, mission: Mission) {
    if (done.has(missionId) || loading) return
    setLoading(missionId)
    try {
      const res = await fetch('/api/mission/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missionId, childId, today }),
      })
      const text = await res.text()
      const json = text ? JSON.parse(text) : {}
      if (!res.ok) {
        showToast(json.error ?? '오류가 발생했어요')
        return
      }
      setDone((prev) => new Set([...prev, missionId]))
      showToast(`🎉 +${mission.credit_reward}🪙 +${mission.exp_reward}EXP`)
    } catch {
      showToast('네트워크 오류가 발생했어요')
    } finally {
      setLoading(null)
    }
  }

  const completedCount = done.size
  const total = missions.length

  return (
    <div className="flex flex-col gap-4">

      {/* 토스트 */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-brand-blue text-white font-bold text-sm px-5 py-2.5 rounded-full shadow-lg animate-bounce">
          {toast}
        </div>
      )}

      {/* 상단 스탯 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5 bg-white/80 rounded-full px-3.5 py-1.5 shadow-sm">
          <span className="text-lg">🔥</span>
          <span className="font-bold text-sm text-brand-text tabular-nums">{streak}일 연속</span>
        </div>
        <div className="flex items-center gap-1.5 bg-brand-yellow/30 ring-1 ring-brand-yellow rounded-full px-3.5 py-1.5 shadow-sm">
          <span className="text-lg">🪙</span>
          <span className="font-bold text-sm text-brand-text tabular-nums">{credits.toLocaleString()}</span>
        </div>
      </div>

      {/* 오늘의 미션 헤더 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">{today}</p>
            <p className="font-black text-brand-text text-lg">⭐ 오늘의 미션</p>
          </div>
          {total > 0 && (
            <div className="flex flex-col items-center">
              <span className="text-2xl font-black text-brand-blue">{completedCount}/{total}</span>
              <span className="text-[10px] text-gray-400">완료</span>
            </div>
          )}
        </div>

        {/* 진행 바 */}
        {total > 0 && (
          <div className="mt-3 h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-green transition-all duration-700"
              style={{ width: `${(completedCount / total) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* 미션 목록 */}
      {missions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <span className="text-7xl">🌱</span>
          <div className="text-center space-y-1">
            <p className="font-bold text-brand-text">아직 미션이 없어요</p>
            <p className="text-sm text-gray-400">부모님이 미션을 만들어주실 거예요!</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {missions.map((mission) => {
            const isCompleted = done.has(mission.id)
            const isLoading = loading === mission.id
            return (
              <div
                key={mission.id}
                className={[
                  'bg-white rounded-2xl p-4 shadow-sm border-2 transition-all',
                  isCompleted ? 'border-brand-green/40 opacity-75' : 'border-transparent',
                ].join(' ')}
              >
                <div className="flex items-start gap-3">
                  {/* 아이콘 */}
                  <div className={[
                    'flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl',
                    isCompleted ? 'bg-brand-green/20' : 'bg-sky-50',
                  ].join(' ')}>
                    {isCompleted ? '✅' : (mission.icon_emoji || '⭐')}
                  </div>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-bold text-sm ${isCompleted ? 'line-through text-gray-400' : 'text-brand-text'}`}>
                        {mission.title}
                      </p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${DIFFICULTY_COLOR[mission.difficulty] ?? 'bg-gray-100 text-gray-500'}`}>
                        {DIFFICULTY_LABEL[mission.difficulty]}
                      </span>
                    </div>
                    {mission.description && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{mission.description}</p>
                    )}

                    {/* 보상 */}
                    <div className="flex items-center gap-2 mt-2">
                      <RewardBadge emoji="🪙" value={mission.credit_reward} />
                      {mission.heart_reward > 0 && <RewardBadge emoji="❤️" value={mission.heart_reward} />}
                      <RewardBadge emoji="✨" value={`+${mission.exp_reward}EXP`} />
                    </div>
                  </div>

                  {/* 완료 버튼 */}
                  <button
                    onClick={() => handleComplete(mission.id, mission)}
                    disabled={isCompleted || isLoading !== false}
                    className={[
                      'flex-shrink-0 ml-1 text-sm font-bold px-3 py-2 rounded-xl transition-all active:scale-95',
                      isCompleted
                        ? 'bg-brand-green/20 text-brand-green cursor-default'
                        : isLoading
                          ? 'bg-gray-100 text-gray-400 cursor-wait'
                          : 'bg-brand-blue text-white shadow-md hover:bg-blue-600',
                    ].join(' ')}
                  >
                    {isCompleted ? '완료!' : isLoading ? '⏳' : '완료'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 전체 완료 축하 */}
      {total > 0 && completedCount === total && (
        <div className="bg-brand-yellow/30 border-2 border-brand-yellow rounded-2xl p-5 text-center">
          <p className="text-3xl mb-2">🎊</p>
          <p className="font-black text-brand-text">오늘 미션 모두 완료!</p>
          <p className="text-sm text-gray-500 mt-1">정말 대단해요! 내일도 화이팅 🌟</p>
        </div>
      )}
    </div>
  )
}

function RewardBadge({ emoji, value }: { emoji: string; value: number | string }) {
  return (
    <span className="inline-flex items-center gap-0.5 bg-gray-50 rounded-full px-2 py-0.5 text-[11px] font-bold text-gray-600">
      <span>{emoji}</span>
      <span>{value}</span>
    </span>
  )
}
