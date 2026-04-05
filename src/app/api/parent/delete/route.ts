import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

/**
 * POST /api/parent/delete
 * 부모 본인 계정(auth.users + profiles)을 영구 삭제합니다.
 *
 * - family_links.parent_id → profiles(id) ON DELETE CASCADE 이므로
 *   이 부모와의 가족 연결 행만 같이 지워집니다.
 * - 자녀 profiles / child_stats / 미션 기록은 그대로 남습니다(자녀 앱 로그인 가능).
 *   자녀까지 없애려면 탈퇴 전 설정의 「자녀 프로필 삭제」로 각각 삭제하세요.
 */
export async function POST() {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 })
  }

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 이 경로로 탈퇴할 수 있어요.' }, { status: 403 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('[parent/delete] SUPABASE_SERVICE_ROLE_KEY 또는 URL 누락')
    return NextResponse.json({ error: '서버 설정 오류로 탈퇴 처리할 수 없어요.' }, { status: 500 })
  }

  const admin = createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error: delErr } = await admin.auth.admin.deleteUser(user.id)
  if (delErr) {
    console.error('[parent/delete] deleteUser:', delErr.message)
    return NextResponse.json({ error: '탈퇴 처리에 실패했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
