/**
 * 아이 앱 홈 탭 — 서버 컴포넌트
 * - child_stats·칭찬 스티커(grants/placements)·아이템 잠금 해제 목록을 조회합니다.
 * - Phase 3: 뱃지/성장지도 쿼리 제거, 항해지도로 교체됨
 */
import { createClient } from '@/lib/supabase/server'
import { getCachedProfileRowById } from '@/lib/childAppDataCache'
import { getActorChildContext } from '@/lib/getActorChildContext'
import HomeTab from '@/components/child/HomeTab'
import type { ChildStats, ChildItemUnlock, PraiseStickerGrant, PraiseStickerPlacement } from '@/types/database'

/** 매 요청 최신 RSC 로 오래된 SSR HTML 과 클라 번들이 어긋나 hydration 이 깨지는 경우를 줄입니다. */
export const dynamic = 'force-dynamic'

export default async function ChildHomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  /** 컨텍스트와 DB 클라이언트를 동시에 준비한 뒤, 인증 확인과 테이블 조회를 한 번에 묶어 TTFB 를 줄입니다. */
  const [ctx, supabase] = await Promise.all([getActorChildContext(), createClient()])
  const childId = ctx.actorChildId
  const resolvedParams = searchParams ? await searchParams : {}
  const openNavMap = resolvedParams.openNavMap === '1'

  const [authRes, statsRes, profileRow, grantsRes, placementsRes, itemUnlocksRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('child_stats').select('*').eq('child_id', childId).maybeSingle(),
    getCachedProfileRowById(childId),
    supabase
      .from('praise_sticker_grants')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false }),

    supabase.from('praise_sticker_placements').select('*').eq('child_id', childId),

    supabase.from('child_item_unlocks').select('item_index').eq('child_id', childId),
  ])
  const user = authRes.data.user

  const initialStats = (statsRes.data ?? null) as ChildStats | null

  const praiseGrants = (grantsRes.data ?? []) as PraiseStickerGrant[]
  const praisePlacements = (placementsRes.data ?? []) as PraiseStickerPlacement[]
  const unlockedItemIndexes = ((itemUnlocksRes.data ?? []) as Pick<ChildItemUnlock, 'item_index'>[]).map((r) => r.item_index)

  const meta = user?.user_metadata as { name?: string } | undefined
  const childName =
    profileRow?.name?.trim() ||
    (ctx.sessionUserId === childId && typeof meta?.name === 'string' ? meta.name.trim() : '') ||
    '쿠앵이'

  const childAvatarUrl = typeof profileRow?.avatar_url === 'string' ? profileRow.avatar_url.trim() || null : null

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
