import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { ROUTINE_KEYWORD_CHIP_TITLES } from '@/lib/routineChips'

/**
 * POST /api/mission/delete-keyword-routine
 * 키워드 칩으로 만든 일상 템플릿(제목이 칩과 일치하는 daily·weekly)만 이 자녀에게서 삭제합니다.
 * 이후 postRoutineKeywordMissions 가 같은 제목으로 다시 넣을 수 있게 비웁니다.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 정리할 수 있어요' }, { status: 403 })
  }

  let body: { childId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  const childId = typeof body.childId === 'string' ? body.childId.trim() : ''
  const uuidOk = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(childId)
  if (!uuidOk) {
    return NextResponse.json({ error: '자녀 id 형식이 올바르지 않아요' }, { status: 400 })
  }

  const { data: link } = await supabase
    .from('family_links')
    .select('id')
    .eq('parent_id', user.id)
    .eq('child_id', childId)
    .maybeSingle()
  if (!link) {
    return NextResponse.json({ error: '연결된 자녀만 정리할 수 있어요' }, { status: 403 })
  }

  const service = createServiceRoleClient()
  const db = service ?? supabase

  const { error } = await db
    .from('missions')
    .delete()
    .eq('linked_child_id', childId)
    .in('title', ROUTINE_KEYWORD_CHIP_TITLES)
    .in('repeat_type', ['daily', 'weekly'])

  if (error) {
    console.error('[mission/delete-keyword-routine]', error)
    const hint =
      error.code === '42501' || String(error.message ?? '').toLowerCase().includes('row-level security')
        ? 'DB에 부모용 미션 삭제 정책이 없을 수 있어요. supabase/migrations/047_missions_parent_delete_update_linked.sql 을 적용해 주세요.'
        : error.code === '23503'
          ? 'mission_logs 가 미션을 참조해 삭제가 막혔어요. supabase/migrations/048_mission_logs_mission_id_on_delete_cascade.sql 을 적용해 주세요.'
          : ''
    return NextResponse.json(
      {
        error: '루틴 템플릿을 지우지 못했어요',
        detail: error.message,
        hint: hint || undefined,
      },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
