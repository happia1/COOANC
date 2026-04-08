import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'

/**
 * POST /api/market/reset-child-hidden-items
 * - body: { childId: string }
 * - 연결된 자녀의 `child_market_hidden_items` 전체를 삭제합니다.
 *
 * 요청사항: 마켓 "메뉴 제어" 탭 초기화용
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
    return NextResponse.json({ error: '부모 계정만 초기화할 수 있어요' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const childId = typeof body.childId === 'string' ? body.childId.trim() : ''
  if (!childId) {
    return NextResponse.json({ error: 'childId 가 필요해요' }, { status: 400 })
  }

  // 연결된 자녀인지 먼저 확인 (에러 메시지 명확화)
  const { data: link, error: linkErr } = await supabase
    .from('family_links')
    .select('id')
    .eq('parent_id', user.id)
    .eq('child_id', childId)
    .maybeSingle()

  if (linkErr || !link) {
    return NextResponse.json({ error: '연결된 자녀만 초기화할 수 있어요' }, { status: 403 })
  }

  const writer = createServiceRoleClient() ?? supabase
  const { error: delErr } = await writer.from('child_market_hidden_items').delete().eq('child_id', childId)

  if (delErr) {
    console.error('[reset-child-hidden-items] delete', delErr.code, delErr.message, delErr.details)
    return NextResponse.json({ error: '초기화에 실패했어요' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

