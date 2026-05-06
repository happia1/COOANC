/**
 * POST /api/child/sleep-session-lock
 * 자녀가 오늘 미션을 모두 끝낸 뒤 수면 모드(잘자 화면)로 들어갈 때 호출합니다.
 * `child_stats.sleep_session_locked_date` 를 서울 기준 오늘 날짜로 설정해,
 * 그날의 미션은 부모가 롤백할 수 없게 합니다.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { getSeoulDateString } from '@/lib/koreaDate'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'child') {
    return NextResponse.json({ error: '자녀 계정만 사용할 수 있어요' }, { status: 403 })
  }

  const childId = user.id
  const seoulToday = getSeoulDateString()

  const svc = createServiceRoleClient()
  if (!svc) {
    return NextResponse.json({ error: '서버 설정 오류' }, { status: 500 })
  }

  const { error: upErr } = await svc
    .from('child_stats')
    .update({
      sleep_session_locked_date: seoulToday,
      updated_at: new Date().toISOString(),
    })
    .eq('child_id', childId)

  if (upErr) {
    console.error('[sleep-session-lock]', upErr.message)
    return NextResponse.json({ error: '수면 모드 기록에 실패했어요' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, date: seoulToday })
}
