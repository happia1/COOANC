'use client'

import type { BadgeRow } from '@/types/database'

const BADGE_TYPE_LABEL: Record<string, { label: string; emoji: string }> = {
  level:   { label: '레벨 뱃지',  emoji: '🌟' },
  streak:  { label: '연속 뱃지',  emoji: '🔥' },
  eq:      { label: 'EQ 뱃지',    emoji: '📊' },
  special: { label: '특별 뱃지',  emoji: '🎀' },
}

type Props = {
  badges: BadgeRow[]
  earnedMap: Record<string, string>   // badge_id → earned_at
  level: number
  streak: number
  longestStreak: number
  childName: string
}

export default function StickerTab({ badges, earnedMap, level, streak, longestStreak, childName }: Props) {
  const earnedCount = Object.keys(earnedMap).length
  const total = badges.length

  // badge_type 별 그룹핑
  const groups: Record<string, BadgeRow[]> = {}
  for (const badge of badges) {
    const t = badge.badge_type ?? 'special'
    if (!groups[t]) groups[t] = []
    groups[t].push(badge)
  }
  const groupOrder = ['level', 'streak', 'eq', 'special']

  return (
    <div className="flex flex-col gap-4">

      {/* 헤더 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">{childName}의 뱃지 컬렉션</p>
          <p className="font-black text-brand-text text-lg">🎀 스티커 보관함</p>
        </div>
        {total > 0 && (
          <div className="text-right">
            <p className="text-2xl font-black text-brand-blue">{earnedCount}<span className="text-base text-gray-400">/{total}</span></p>
            <p className="text-[10px] text-gray-400">획득 완료</p>
          </div>
        )}
      </div>

      {/* 내 스탯 요약 */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard emoji="🌱" label="현재 레벨" value={`Lv.${level}`} />
        <StatCard emoji="🔥" label="현재 연속" value={`${streak}일`} />
        <StatCard emoji="🏆" label="최장 연속" value={`${longestStreak}일`} />
      </div>

      {/* 전체 획득 프로그레스 */}
      {total > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-gray-500">전체 진행도</span>
            <span className="text-xs font-bold text-brand-blue">{Math.round((earnedCount / total) * 100)}%</span>
          </div>
          <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-green transition-all duration-700"
              style={{ width: `${(earnedCount / total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* 뱃지 없음 */}
      {badges.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <span className="text-7xl">🎀</span>
          <div className="text-center space-y-1">
            <p className="font-bold text-brand-text">아직 뱃지가 없어요</p>
            <p className="text-sm text-gray-400">미션을 완료하면 뱃지를 받을 수 있어요!</p>
          </div>
        </div>
      )}

      {/* 그룹별 뱃지 */}
      {groupOrder.map((type) => {
        const list = groups[type]
        if (!list || list.length === 0) return null
        const meta = BADGE_TYPE_LABEL[type] ?? { label: type, emoji: '🏅' }
        return (
          <section key={type}>
            <p className="text-sm font-bold text-brand-text mb-2 px-1">
              {meta.emoji} {meta.label}
            </p>
            <div className="grid grid-cols-4 gap-2">
              {list.map((badge) => {
                const isEarned = badge.badge_id in earnedMap
                const earnedAt = earnedMap[badge.badge_id]
                return (
                  <div
                    key={badge.badge_id}
                    title={`${badge.name}${badge.description ? `\n${badge.description}` : ''}`}
                    className={[
                      'flex flex-col items-center gap-1 p-2.5 rounded-2xl transition-all',
                      isEarned
                        ? 'bg-brand-yellow/20 ring-2 ring-brand-yellow/50 shadow-sm'
                        : 'bg-gray-50 opacity-40 grayscale',
                    ].join(' ')}
                  >
                    <span className="text-3xl leading-none">{badge.icon_emoji ?? '🏅'}</span>
                    <span className="text-[9px] font-bold text-center text-gray-600 leading-tight line-clamp-2 w-full">
                      {badge.name}
                    </span>
                    {isEarned && earnedAt && (
                      <span className="text-[8px] text-brand-blue font-bold">
                        {earnedAt.slice(0, 10)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {/* 전체 획득 축하 */}
      {total > 0 && earnedCount === total && (
        <div className="bg-brand-yellow/30 border-2 border-brand-yellow rounded-2xl p-5 text-center">
          <p className="text-3xl mb-2">🏆</p>
          <p className="font-black text-brand-text">모든 뱃지 획득 완료!</p>
          <p className="text-sm text-gray-500 mt-1">정말 대단해요, {childName}!</p>
        </div>
      )}
    </div>
  )
}

function StatCard({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
      <p className="text-xl">{emoji}</p>
      <p className="text-xs font-black text-brand-text mt-0.5 tabular-nums">{value}</p>
      <p className="text-[9px] text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}
