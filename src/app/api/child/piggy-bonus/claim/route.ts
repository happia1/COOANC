import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'

/**
 * POST /api/child/piggy-bonus/claim
 * body: { childId?, count? }
 *
 * 저금통 위에 뜬 반짝이는 보너스 코인을 눌러서 받아 갑니다(기본 1개).
 * 남은 개수는 DB 함수 `claim_piggy_bonus` 가 **행 잠금** 안에서 확인하므로,
 * 아이가 아무리 빠르게 연타해도 쌓인 개수보다 많이 받을 수 없습니다.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  let bodyChildId: unknown
  let countRaw: unknown
  try {
    const body = await req.json()
    bodyChildId = body?.childId
    countRaw = body?.count
  } catch {
    /* 본문 없이 부르면 1개 */
  }

  const count = typeof countRaw === 'number' ? Math.floor(countRaw) : 1
  if (!Number.isFinite(count) || count < 1) {
    return NextResponse.json({ error: '받을 개수를 확인해 주세요' }, { status: 400 })
  }

  const resolved = await resolveApiActorChildId(supabase, user, bodyChildId)
  if (resolved.ok === false) return resolved.response

  const { data, error } = await supabase.rpc('claim_piggy_bonus', {
    p_child_id: resolved.childId,
    p_count: count,
  })

  if (error) {
    console.warn('[piggy-bonus/claim] 받기 실패(128 마이그레이션 필요?):', error.message)
    return NextResponse.json({ error: '보너스를 받지 못했어요' }, { status: 500 })
  }

  return NextResponse.json(data ?? { claimed: 0, pending: 0 }, { status: 200 })
}
