/**
 * 아이 앱 홈 탭 — 서버 컴포넌트
 * - child_stats·칭찬 스티커(grants/placements)·아이템 잠금 해제 목록을 조회합니다.
 * - Phase 3: 뱃지/성장지도 쿼리 제거, 항해지도로 교체됨
 */
import { createClient } from '@/lib/supabase/server'
import { getActorChildContext } from '@/lib/getActorChildContext'
import { isRetriableMissingColumnError } from '@/lib/supabase/childProfileSelect'
import HomeTab from '@/components/child/HomeTab'
import type { ChildStats, ChildItemUnlock, PraiseStickerGrant, PraiseStickerPlacement } from '@/types/database'

/** 홈 탭에 쓰는 프로필 한 줄 — 구형 DB 는 `avatar_url` 컬럼 없이 name·role 만 올 수 있음 */
type ChildProfileForHome = {
  name: string | null
  role: string | null
  /** 스키마에 컬럼이 없으면 이 필드가 비어 있을 수 있음 */
  avatar_url?: string | null
}

/** 매 요청 최신 RSC 로 오래된 SSR HTML 과 클라 번들이 어긋나 hydration 이 깨지는 경우를 줄입니다. */
export const dynamic = 'force-dynamic'

export default async function ChildHomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await getActorChildContext()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const childId = ctx.actorChildId
  const resolvedParams = searchParams ? await searchParams : {}
  const openNavMap = resolvedParams.openNavMap === '1'

  const [statsRes, profileRes, grantsRes, placementsRes, itemUnlocksRes] = await Promise.all([
    supabase.from('child_stats').select('*').eq('child_id', childId).maybeSingle(),

    supabase.from('profiles').select('name, role, avatar_url').eq('id', childId).maybeSingle(),

    supabase
      .from('praise_sticker_grants')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false }),

    supabase.from('praise_sticker_placements').select('*').eq('child_id', childId),

    supabase.from('child_item_unlocks').select('item_index').eq('child_id', childId),
  ])

  const initialStats = (statsRes.data ?? null) as ChildStats | null

  const praiseGrants = (grantsRes.data ?? []) as PraiseStickerGrant[]
  const praisePlacements = (placementsRes.data ?? []) as PraiseStickerPlacement[]
  const unlockedItemIndexes = ((itemUnlocksRes.data ?? []) as Pick<ChildItemUnlock, 'item_index'>[]).map((r) => r.item_index)

  /** `avatar_url` 컬럼이 없는 구형 DB 는 name·role 만 다시 읽습니다 */
  let profileRow: ChildProfileForHome | null = profileRes.data as ChildProfileForHome | null
  if (profileRes.error && isRetriableMissingColumnError(profileRes.error)) {
    const fallback = await supabase.from('profiles').select('name, role').eq('id', childId).maybeSingle()
    profileRow = fallback.data as ChildProfileForHome | null
  }

  const meta = user?.user_metadata as { name?: string } | undefined
  const childName =
    profileRow?.name?.trim() ||
    (ctx.sessionUserId === childId && typeof meta?.name === 'string' ? meta.name.trim() : '') ||
    '쿠앵이'

  const childAvatarUrl =
    profileRow && typeof profileRow.avatar_url === 'string' ? profileRow.avatar_url.trim() || null : null

  return (
    <HomeTab
      childId={childId}
      initialStats={initialStats}
      childName={childName}
      childAvatarUrl={childAvatarUrl}
      initialPraiseGrants={praiseGrants}
      initialPraisePlacements={praisePlacements}
      initialUnlockedItemIndexes={unlockedItemIndexes}
      initialMapOpen={openNavMap}
    />
  )
}
