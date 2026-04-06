import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'

/**
 * POST /api/market/child-hidden-item
 * 부모가 자녀 마켓에서 상품을 숨기거나 다시 보이게 합니다.
 * body: { childId: string, itemId: string, hidden: boolean }
 *
 * - 세션으로 부모·가족 연결만 검증한 뒤, 쓰기는 가능하면 service_role 로 수행합니다.
 *   (RLS·PostgREST upsert onConflict 조합에서 간헐 실패하는 환경을 피합니다.)
 * - 숨김 추가는 INSERT + PK 중복(23505) 허용으로 멱등 처리합니다.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 설정할 수 있어요' }, { status: 403 })
  }

  let childId: string
  let itemId: string
  let hidden: boolean
  try {
    const body = await req.json()
    childId = body.childId
    itemId = body.itemId
    hidden = Boolean(body.hidden)
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!childId || !itemId) {
    return NextResponse.json({ error: '자녀와 상품 정보가 필요해요' }, { status: 400 })
  }

  const { data: link } = await supabase
    .from('family_links')
    .select('id')
    .eq('parent_id', user.id)
    .eq('child_id', childId)
    .maybeSingle()

  if (!link) {
    return NextResponse.json({ error: '연결된 자녀만 설정할 수 있어요' }, { status: 403 })
  }

  /** 연결 검증은 사용자 세션, 실제 INSERT/DELETE 는 RLS 우회(키가 있을 때만) */
  const writer = createServiceRoleClient() ?? supabase

  if (hidden) {
    const { error } = await writer.from('child_market_hidden_items').insert({
      child_id: childId,
      store_item_id: itemId,
    })
    /** 이미 숨김 행이 있으면 PK 충돌 — 성공으로 간주 */
    if (error && error.code !== '23505') {
      console.error('[child-hidden-item] insert', error.code, error.message, error.details)
      return NextResponse.json({ error: '저장하지 못했어요' }, { status: 500 })
    }
  } else {
    const { error } = await writer
      .from('child_market_hidden_items')
      .delete()
      .eq('child_id', childId)
      .eq('store_item_id', itemId)
    if (error) {
      console.error('[child-hidden-item] delete', error.code, error.message, error.details)
      return NextResponse.json({ error: '저장하지 못했어요' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
