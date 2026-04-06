/**
 * 아이 앱 스티커(뱃지) 탭 — 서버 컴포넌트
 * - getActorChildContext 의 자녀 id 기준으로 뱃지·통계를 불러옵니다.
 */
import { createClient } from '@/lib/supabase/server'
import { getActorChildContext } from '@/lib/getActorChildContext'
import StickerTab from '@/components/child/StickerTab'
import type { BadgeRow } from '@/types/database'

export default async function StickerPage() {
  const ctx = await getActorChildContext()
  const supabase = await createClient()
  const childId = ctx.actorChildId

  const [badgesRes, earnedRes, statsRes, profileRes] = await Promise.all([
    supabase
      .from('badges')
      .select('badge_id, name, description, icon_emoji, badge_type, condition')
      .order('badge_type', { ascending: true }),

    supabase.from('child_badges').select('badge_id, earned_at').eq('child_id', childId),

    supabase
      .from('child_stats')
      .select('current_level, streak_days, longest_streak')
      .eq('child_id', childId)
      .maybeSingle(),

    supabase.from('profiles').select('name').eq('id', childId).maybeSingle(),
  ])

  const badges = (badgesRes.data ?? []) as BadgeRow[]
  const earned: Record<string, string> = {}
  for (const b of earnedRes.data ?? []) {
    earned[b.badge_id] = b.earned_at
  }

  const level = statsRes.data?.current_level ?? 0
  const streak = statsRes.data?.streak_days ?? 0
  const longestStreak = statsRes.data?.longest_streak ?? 0
  const childName = profileRes.data?.name ?? '쿠앵이'

  return (
    <StickerTab
      badges={badges}
      earnedMap={earned}
      level={level}
      streak={streak}
      longestStreak={longestStreak}
      childName={childName}
    />
  )
}
