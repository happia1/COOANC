/**
 * 아이 앱 홈 탭 — 서버 컴포넌트
 * - child_stats·뱃지·칭찬 스티커(grants/placements) 를 같은 자녀 id 로 조회합니다.
 */
import { createClient } from '@/lib/supabase/server'
import { getActorChildContext } from '@/lib/getActorChildContext'
import { isRetriableMissingColumnError } from '@/lib/supabase/childProfileSelect'
import HomeTab from '@/components/child/HomeTab'
import type { ChildStats, BadgeRow, PraiseStickerGrant, PraiseStickerPlacement } from '@/types/database'

/** 매 요청 최신 RSC 로 오래된 SSR HTML 과 클라 번들이 어긋나 hydration 이 깨지는 경우를 줄입니다. */
export const dynamic = 'force-dynamic'

export default async function ChildHomePage() {
  const ctx = await getActorChildContext()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const childId = ctx.actorChildId

  const [statsRes, profileRes, earnedRes, allBadgesRes, grantsRes, placementsRes] = await Promise.all([
    supabase.from('child_stats').select('*').eq('child_id', childId).maybeSingle(),

    supabase.from('profiles').select('name, role, avatar_url').eq('id', childId).maybeSingle(),

    supabase.from('child_badges').select('badge_id, earned_at').eq('child_id', childId),

    supabase
      .from('badges')
      .select('badge_id, name, description, icon_emoji, badge_type, condition')
      .order('badge_type', { ascending: true }),

    supabase
      .from('praise_sticker_grants')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false }),

    supabase.from('praise_sticker_placements').select('*').eq('child_id', childId),
  ])

  const initialStats = (statsRes.data ?? null) as ChildStats | null

  const earnedMap: Record<string, string> = {}
  for (const row of earnedRes.data ?? []) {
    earnedMap[row.badge_id] = row.earned_at
  }

  const growthMapData = {
    badges: (allBadgesRes.data ?? []) as BadgeRow[],
    earnedMap,
    level: initialStats?.current_level ?? 0,
    streak: initialStats?.streak_days ?? 0,
    longestStreak: initialStats?.longest_streak ?? 0,
  }

  const praiseGrants = (grantsRes.data ?? []) as PraiseStickerGrant[]
  const praisePlacements = (placementsRes.data ?? []) as PraiseStickerPlacement[]

  /** `avatar_url` 컬럼이 없는 구형 DB 는 name 만 다시 읽습니다 */
  let profileRow = profileRes.data
  if (profileRes.error && isRetriableMissingColumnError(profileRes.error)) {
    const fallback = await supabase.from('profiles').select('name, role').eq('id', childId).maybeSingle()
    profileRow = fallback.data
  }

  const meta = user?.user_metadata as { name?: string } | undefined
  const childName =
    profileRow?.name?.trim() ||
    (ctx.sessionUserId === childId && typeof meta?.name === 'string' ? meta.name.trim() : '') ||
    '쿠앵이'

  const childAvatarUrl =
    profileRow && typeof (profileRow as { avatar_url?: string | null }).avatar_url === 'string'
      ? (profileRow as { avatar_url: string }).avatar_url.trim() || null
      : null

  return (
    <HomeTab
      childId={childId}
      initialStats={initialStats}
      childName={childName}
      childAvatarUrl={childAvatarUrl}
      growthMapData={growthMapData}
      initialPraiseGrants={praiseGrants}
      initialPraisePlacements={praisePlacements}
    />
  )
}
