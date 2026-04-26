import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import { readChildStatInt } from '@/lib/childCreditsSplit'
import type { PurchaseRequest } from '@/types/database'

/**
 * GET /api/market/child-sync?childId=UUID
 * - 자녀 마켓 탭 5초 폴링용: 브라우저 PostgREST 직접 호출 대신 서버에서 조회해
 *   세션·child_id 위조·쿼리 문자열 이슈로 인한 400 을 줄입니다.
 * - `resolveApiActorChildId`: 자녀 로그인 시 본인 id만, 부모 미리보기 시 family_links 검증
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })
  }

  const q = req.nextUrl.searchParams.get('childId')
  const resolved = await resolveApiActorChildId(supabase, user, q)
  if (resolved.ok === false) return resolved.response

  const childId = resolved.childId

  const prCols =
    'id, child_id, item_id, item_name, item_price, item_type, status, child_message, parent_note, requested_at, approved_at, delivered_at'

  const [hiddenRes, prRes, statsRes] = await Promise.all([
    supabase.from('child_market_hidden_items').select('store_item_id').eq('child_id', childId),
    supabase
      .from('purchase_requests')
      .select(prCols)
      .eq('child_id', childId)
      .order('requested_at', { ascending: false })
      .limit(12),
    supabase.from('child_stats').select('credits, credits_wallet').eq('child_id', childId).maybeSingle(),
  ])

  if (prRes.error) {
    console.error('[api/market/child-sync] purchase_requests:', prRes.error.message, prRes.error)
    return NextResponse.json(
      { error: '구매 요청을 불러오지 못했어요', details: prRes.error.message },
      { status: 500 },
    )
  }

  const srow = statsRes.data as { credits?: number; credits_wallet?: number } | null
  return NextResponse.json({
    hiddenStoreItemIds: hiddenRes.error
      ? []
      : ((hiddenRes.data ?? []) as { store_item_id: string }[]).map((r) => r.store_item_id).sort(),
    purchaseRequests: (prRes.data ?? []) as PurchaseRequest[],
    /** 총 코인(단일·멀티 공통) — `MarketTab`이 연령/레벨에 따라 총액·지갑 중 표시에 씀 */
    credits: srow && typeof srow.credits === 'number' ? readChildStatInt(srow.credits) : null,
    creditsWallet: srow && srow.credits_wallet !== undefined ? readChildStatInt(srow.credits_wallet) : null,
    /** 숨김·통계 조회 오류는 비치명적 — 클라이언트가 이전 상태를 유지 */
    partial: Boolean(hiddenRes.error || statsRes.error),
  })
}
