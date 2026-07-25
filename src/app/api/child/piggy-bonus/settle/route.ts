import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'

/**
 * POST /api/child/piggy-bonus/settle
 * body: { childId? }
 *
 * 저금통 보너스(이자)를 정산합니다.
 * - 계산·지급은 DB 함수 `settle_piggy_bonus` 가 **행 잠금** 안에서 처리하므로,
 *   여러 기기에서 동시에 호출해도 중복 지급되지 않습니다.
 * - 조건이 안 되면 `paid: 0` 을 돌려줍니다(그냥 호출해도 안전).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  let bodyChildId: unknown = undefined
  try {
    const body = await req.json()
    bodyChildId = body?.childId
  } catch {
    /* 본문 없이 불러도 됩니다(자녀 본인 계정) */
  }

  const resolved = await resolveApiActorChildId(supabase, user, bodyChildId)
  if (resolved.ok === false) return resolved.response

  const { data, error } = await supabase.rpc('settle_piggy_bonus', { p_child_id: resolved.childId })

  if (error) {
    /** 127 마이그레이션 미적용 DB — 앱이 멈추지 않도록 조용히 0 처리 */
    console.warn('[piggy-bonus/settle] 정산 실패(127 마이그레이션 필요?):', error.message)
    return NextResponse.json({ paid: 0, periods: 0, unavailable: true }, { status: 200 })
  }

  return NextResponse.json(data ?? { paid: 0, periods: 0 }, { status: 200 })
}
