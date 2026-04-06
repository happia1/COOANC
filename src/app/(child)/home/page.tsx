/**
 * 아이 앱 홈 탭 — 서버 컴포넌트
 * - `(child)` 레이아웃에서 getActorChildContext 로 「어느 자녀 기준」인지 정한 뒤,
 *   child_stats·뱃지 등을 그 id 로 조회합니다.
 * - 부모가 홈에서 자녀 카드를 눌러 들어온 경우에도 같은 컴포넌트를 씁니다.
 */
import { createClient } from '@/lib/supabase/server'
import { getActorChildContext } from '@/lib/getActorChildContext'
import HomeTab from '@/components/child/HomeTab'
import type { ChildStats, BadgeRow } from '@/types/database'

export default async function ChildHomePage() {
  const ctx = await getActorChildContext()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const childId = ctx.actorChildId

  const [statsRes, profileRes, earnedRes, badgesRes] = await Promise.all([
    supabase.from('child_stats').select('*').eq('child_id', childId).maybeSingle(),

    supabase.from('profiles').select('name, role').eq('id', childId).maybeSingle(),

    supabase.from('child_badges').select('badge_id').eq('child_id', childId),

    supabase
      .from('badges')
      .select('badge_id, name, description, icon_emoji, badge_type, condition')
      .in('badge_type', ['level', 'streak'])
      .order('badge_type', { ascending: true })
      .limit(8),
  ])

  const initialStats = (statsRes.data ?? null) as ChildStats | null
  const displayBadges = (badgesRes.data ?? []) as BadgeRow[]
  const earnedBadgeIds = (earnedRes.data ?? []).map((b) => b.badge_id)

  const meta = user?.user_metadata as { name?: string } | undefined
  const childName =
    profileRes.data?.name?.trim() ||
    (ctx.sessionUserId === childId && typeof meta?.name === 'string' ? meta.name.trim() : '') ||
    '쿠앵이'

  return (
    <HomeTab
      childId={childId}
      initialStats={initialStats}
      displayBadges={displayBadges}
      earnedBadgeIds={earnedBadgeIds}
      childName={childName}
    />
  )
}
