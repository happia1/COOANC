import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { isSpecialSectionMission } from '@/lib/specialMissionChips'

/**
 * POST /api/mission/patch-repeat-type
 * 스페셜 템플릿의 repeat_type 을 daily(매일 자동) ↔ event(이벤트) 로 바꿉니다.
 */

const uuidOk = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 수정할 수 있어요' }, { status: 403 })
  }

  let missionId: string
  let repeatType: string
  try {
    const b = await req.json()
    missionId = String(b.missionId ?? '').trim()
    repeatType = String(b.repeatType ?? '').trim()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!uuidOk(missionId)) {
    return NextResponse.json({ error: 'missionId가 올바르지 않아요' }, { status: 400 })
  }

  if (repeatType !== 'daily' && repeatType !== 'event') {
    return NextResponse.json({ error: 'repeatType은 daily 또는 event 여야 해요' }, { status: 400 })
  }

  const { data: mission, error: mErr } = await supabase.from('missions').select('*').eq('id', missionId).maybeSingle()
  if (mErr || !mission) {
    return NextResponse.json({ error: '미션을 찾을 수 없어요' }, { status: 404 })
  }

  const childId = mission.linked_child_id as string | null
  if (!childId || !uuidOk(childId)) {
    return NextResponse.json({ error: '자녀 전용 템플릿만 바꿀 수 있어요' }, { status: 403 })
  }

  if (!isSpecialSectionMission(mission)) {
    return NextResponse.json({ error: '스페셜 템플릿만 이 경로로 바꿀 수 있어요' }, { status: 400 })
  }

  const { data: link } = await supabase
    .from('family_links')
    .select('id')
    .eq('parent_id', user.id)
    .eq('child_id', childId)
    .maybeSingle()
  if (!link) {
    return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })
  }

  const service = createServiceRoleClient()
  const db = service ?? supabase
  const { data: updated, error: upErr } = await db
    .from('missions')
    .update({
      repeat_type: repeatType,
      difficulty: 'special',
    })
    .eq('id', missionId)
    .select()
    .single()

  if (upErr) {
    console.error('[mission/patch-repeat-type]', upErr)
    return NextResponse.json({ error: '저장에 실패했어요' }, { status: 500 })
  }

  return NextResponse.json({ mission: updated }, { status: 200 })
}
