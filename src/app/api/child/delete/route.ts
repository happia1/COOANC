import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

/**
 * POST /api/child/delete
 * 부모가 자녀 프로필을 영구 삭제합니다.
 *
 * 처리 순서:
 * 1. 요청자가 로그인된 부모인지 확인
 * 2. family_links로 본인-해당 자녀 연결 여부 확인
 * 3. profiles.role === 'child' 검증 (부모 계정 등 오삭제 방지)
 * 4. Admin API로 auth.users 삭제 → profiles·child_stats·mission_logs·family_links 등
 *    FK CASCADE로 함께 정리됩니다.
 */
export async function POST(req: NextRequest) {
  let childId: string
  try {
    ;({ childId } = await req.json())
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 })
  }

  if (!childId) {
    return NextResponse.json({ error: 'childId가 누락됐어요.' }, { status: 400 })
  }

  // 1. 요청자 인증 확인
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: '인증되지 않은 요청이에요.' }, { status: 401 })
  }

  // 2. 요청자가 부모인지 확인
  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (me?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 삭제할 수 있어요.' }, { status: 403 })
  }

  // 3. family_links로 본인-자녀 연결 확인
  const { data: link } = await supabase
    .from('family_links')
    .select('id')
    .eq('parent_id', user.id)
    .eq('child_id', childId)
    .maybeSingle()

  if (!link) {
    return NextResponse.json({ error: '해당 자녀와 연결되어 있지 않아요.' }, { status: 403 })
  }

  // 4. 삭제 대상이 child 역할인지 확인 (부모 계정 오삭제 방지)
  const { data: childProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', childId)
    .maybeSingle()

  if (childProfile?.role !== 'child') {
    return NextResponse.json({ error: '자녀 계정만 삭제할 수 있어요.' }, { status: 403 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // 5a. 이 자녀에만 묶인 미션 템플릿 행을 먼저 제거 (FK 미적용·지연 환경에서도 루틴 탭 잔상 방지)
  const { error: missionDelErr } = await admin.from('missions').delete().eq('linked_child_id', childId)
  if (missionDelErr) {
    console.error('[child/delete] missions delete:', missionDelErr)
    return NextResponse.json({ error: '연결된 미션 정리 중 오류가 났어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
  }

  // 5b. auth.users 삭제 → profiles·나머지 테이블은 FK CASCADE 로 정리
  const { error: deleteErr } = await admin.auth.admin.deleteUser(childId)

  if (deleteErr) {
    console.error('[child/delete] auth.admin.deleteUser error:', deleteErr)
    return NextResponse.json({ error: '삭제 중 오류가 발생했어요. 다시 시도해주세요.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
