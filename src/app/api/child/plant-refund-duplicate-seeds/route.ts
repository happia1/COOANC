import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import { refundDuplicatePlantSeedPurchases } from '@/lib/plantSeedRefund'

/**
 * POST /api/child/plant-refund-duplicate-seeds
 * body: { childId? }
 *
 * 중복 탭으로 쌓인 씨앗 구매 이력을 정리하고 크레딧을 되돌립니다(최근 1건만 유지).
 */
export async function POST(req: NextRequest) {
  try {
    const authSupabase = await createClient()
    const {
      data: { user },
    } = await authSupabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })
    }

    let bodyChildId: unknown
    try {
      bodyChildId = (await req.json())?.childId
    } catch {
      bodyChildId = undefined
    }

    const resolved = await resolveApiActorChildId(authSupabase, user, bodyChildId)
    if (resolved.ok === false) return resolved.response
    const childId = resolved.childId

    const db = createServiceRoleClient() ?? authSupabase
    const result = await refundDuplicatePlantSeedPurchases(db, childId)

    if (result.ok === false) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      refundedCredits: result.refundedCredits,
      removedPurchases: result.removedCount,
      keptPurchaseId: result.keptPurchaseId,
      newCredits: result.newCredits,
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    console.error('[plant-refund-duplicate-seeds] unexpected', e)
    return NextResponse.json({ error: '서버 오류가 발생했어요', detail }, { status: 500 })
  }
}
