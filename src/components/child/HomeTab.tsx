'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ChildStats, BadgeRow } from '@/types/database'

// ============================================================
// 레벨 메타데이터 (master_doc Part 1 기준)
// ============================================================
const LEVELS = [
  { level: 0, name: '씨앗',   emoji: '🌱' },
  { level: 1, name: '새싹',   emoji: '🌿' },
  { level: 2, name: '교환사', emoji: '🤝' },
  { level: 3, name: '저축왕', emoji: '🐷' },
  { level: 4, name: '나눔이', emoji: '💝' },
  { level: 5, name: '투자가', emoji: '🚀' },
] as const

type Props = {
  childId: string
  initialStats: ChildStats | null
  displayBadges: BadgeRow[]
  earnedBadgeIds: string[]
  childName: string
}

/**
 * 아이 앱 홈 탭 — 클라이언트 컴포넌트
 *
 * Realtime 구독: child_stats (UPDATE)
 * 표시: 캐릭터 / 레벨 / EXP 게이지 / 성장 지도 / 뱃지
 *
 * 가드레일: credits 직접 조작 없음 — 표시 전용
 */
export default function HomeTab({ childId, initialStats, displayBadges, earnedBadgeIds, childName }: Props) {
  const [stats, setStats] = useState<ChildStats | null>(initialStats)
  const [earnedIds] = useState<Set<string>>(new Set(earnedBadgeIds))

  // ── Realtime 구독 (child_stats UPDATE)
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`child_stats:${childId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'child_stats',
          filter: `child_id=eq.${childId}`,
        },
        (payload) => {
          setStats(payload.new as ChildStats)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [childId])

  // ── 아직 child_stats 미생성 상태
  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-5">
        <span className="text-8xl animate-bounce">🐣</span>
        <div className="text-center space-y-1">
          <p className="font-bold text-brand-text text-xl">안녕, {childName}!</p>
          <p className="text-gray-400 text-sm">부모님이 미션을 만들어주실 거야 🌟</p>
        </div>
      </div>
    )
  }

  const currentLevel = LEVELS[stats.current_level]
  const expPercent   = Math.min((stats.exp / stats.exp_to_next_level) * 100, 100)
  const expRemaining = stats.exp_to_next_level - stats.exp

  return (
    <div className="flex flex-col gap-5">

      {/* ── 상단 스탯 바 */}
      <div className="flex justify-between items-center">
        <StatPill emoji="🔥" value={`${stats.streak_days}일 연속`} />
        <StatPill emoji="🪙" value={stats.credits.toLocaleString()} highlight />
      </div>

      {/* ── 캐릭터 영역 */}
      <div className="flex flex-col items-center gap-3">
        {/* 캐릭터 원형 배경 — 에셋 준비 전 이모지 플레이스홀더 */}
        <div className="relative flex items-center justify-center w-48 h-48 rounded-full bg-gradient-to-br from-brand-blue/10 to-brand-green/10 ring-4 ring-white shadow-lg">
          <span
            className="text-[88px] select-none"
            role="img"
            aria-label="쿠앵이 캐릭터"
          >
            🐣
          </span>

          {/* 레벨 뱃지 */}
          <div className="absolute -bottom-3 bg-brand-blue text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-md">
            Lv.{stats.current_level}&nbsp;{currentLevel.name}
          </div>
        </div>

        <p className="mt-2 font-bold text-brand-text text-lg">
          {childName}의 쿠앵이
        </p>

        {/* 승급 대기 중 배너 */}
        {stats.promotion_pending && (
          <div className="flex items-center gap-2 bg-brand-yellow/40 border border-brand-yellow rounded-xl px-4 py-2">
            <span className="text-lg">🎉</span>
            <span className="text-xs font-bold text-brand-text">레벨 업 대기 중! 부모님 확인을 기다려요</span>
          </div>
        )}
      </div>

      {/* ── EXP 게이지 */}
      <section className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex justify-between items-center mb-2.5">
          <span className="text-sm font-bold text-brand-text">✨ 경험치 (EXP)</span>
          <span className="text-xs text-gray-400 tabular-nums">
            {stats.exp} / {stats.exp_to_next_level}
          </span>
        </div>

        <div className="h-5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-green transition-all duration-700 ease-out"
            style={{ width: `${expPercent}%` }}
          />
        </div>

        {stats.current_level < 5 ? (
          <p className="text-[11px] text-gray-400 mt-1.5 text-right">
            다음 레벨까지 <span className="font-bold text-brand-blue">{expRemaining}</span> EXP
          </p>
        ) : (
          <p className="text-[11px] text-brand-green font-bold mt-1.5 text-right">
            🏆 최고 레벨 달성!
          </p>
        )}
      </section>

      {/* ── 성장 지도 (레벨 맵) */}
      <section className="bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-sm font-bold text-brand-text mb-3">🗺️ 성장 지도</p>
        <div className="flex items-center overflow-x-auto pb-1 gap-1" style={{ scrollbarWidth: 'none' }}>
          {LEVELS.map((lv, idx) => {
            const isPast    = lv.level < stats.current_level
            const isCurrent = lv.level === stats.current_level
            const isFuture  = lv.level > stats.current_level
            return (
              <div key={lv.level} className="flex items-center gap-1 flex-shrink-0">
                <div
                  className={[
                    'flex flex-col items-center gap-1 rounded-xl px-2.5 py-2 min-w-[52px] transition-all',
                    isPast    ? 'bg-brand-green/20'                              : '',
                    isCurrent ? 'bg-brand-yellow/40 ring-2 ring-brand-yellow scale-105' : '',
                    isFuture  ? 'opacity-35'                                     : '',
                  ].join(' ')}
                >
                  <span className="text-xl leading-none">{lv.emoji}</span>
                  <span className={`text-[10px] font-bold leading-none ${isCurrent ? 'text-brand-text' : 'text-gray-400'}`}>
                    {lv.name}
                  </span>
                </div>

                {idx < LEVELS.length - 1 && (
                  <span className={`text-xs font-bold ${isPast ? 'text-brand-green' : 'text-gray-200'}`}>
                    →
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── EQ 지수 요약 */}
      <section className="bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-sm font-bold text-brand-text mb-3">📊 경제 EQ 지수</p>
        <div className="grid grid-cols-3 gap-2">
          <EqBar label="루틴 완주율" value={stats.eq_routine_rate} color="bg-brand-blue" />
          <EqBar label="만족 지연"   value={stats.eq_delay_score}  color="bg-brand-green" />
          <EqBar label="저축 비중"   value={stats.eq_save_ratio}   color="bg-amber-400" />
        </div>
      </section>

      {/* ── 뱃지 */}
      {displayBadges.length > 0 && (
        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-bold text-brand-text mb-3">🏅 내 뱃지</p>
          <div className="grid grid-cols-4 gap-2">
            {displayBadges.map(badge => {
              const isEarned = earnedIds.has(badge.badge_id)
              return (
                <div
                  key={badge.badge_id}
                  title={badge.name}
                  className={[
                    'flex flex-col items-center gap-1 p-2 rounded-xl transition-all',
                    isEarned
                      ? 'bg-brand-yellow/20 ring-1 ring-brand-yellow/50'
                      : 'bg-gray-50 opacity-35 grayscale',
                  ].join(' ')}
                >
                  <span className="text-2xl leading-none">{badge.icon_emoji ?? '🏅'}</span>
                  <span className="text-[9px] text-center text-gray-600 leading-tight line-clamp-2 w-full">
                    {badge.name}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

    </div>
  )
}

// ── 서브 컴포넌트 ──────────────────────────────────────────

function StatPill({ emoji, value, highlight = false }: { emoji: string; value: string; highlight?: boolean }) {
  return (
    <div className={[
      'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 shadow-sm',
      highlight ? 'bg-brand-yellow/30 ring-1 ring-brand-yellow' : 'bg-white/80',
    ].join(' ')}>
      <span className="text-lg leading-none">{emoji}</span>
      <span className="font-bold text-sm text-brand-text tabular-nums">{value}</span>
    </div>
  )
}

function EqBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* 세로 바 */}
      <div className="w-full h-16 bg-gray-100 rounded-lg overflow-hidden flex flex-col-reverse">
        <div
          className={`${color} rounded-lg transition-all duration-700`}
          style={{ height: `${value}%` }}
        />
      </div>
      <span className="text-[10px] font-bold text-brand-blue tabular-nums">{value}%</span>
      <span className="text-[9px] text-gray-400 text-center leading-tight">{label}</span>
    </div>
  )
}
