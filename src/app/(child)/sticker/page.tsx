/**
 * 아이 앱 스티커(뱃지) 탭 — 서버 컴포넌트
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StickerTab from '@/components/child/StickerTab'
import type { BadgeRow } from '@/types/database'

export default async function StickerPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [badgesRes, earnedRes, statsRes, profileRes] = await Promise.all([
    supabase
      .from('badges')
      .select('badge_id, name, description, icon_emoji, badge_type, condition')
      .order('badge_type', { ascending: true }),

    supabase
      .from('child_badges')
      .select('badge_id, earned_at')
      .eq('child_id', user.id),

    supabase
      .from('child_stats')
      .select('current_level, streak_days, longest_streak')
      .eq('child_id', user.id)
      .maybeSingle(),

    supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .maybeSingle(),
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
