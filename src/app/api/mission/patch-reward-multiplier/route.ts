import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { isSpecialSectionMission } from '@/lib/specialMissionChips'
import type { Mission } from '@/types/database'

/**
 * PATCH /api/mission/patch-reward-multiplier
 * 연결된 자녀의 스페셜 미션 템플릿에만 보상 배율(1·2·3)을 저장합니다.
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  let missionId: string
  let reward_multiplier: number
  try {
    const b = await req.json()
    missionId = String(b.missionId ?? '').trim()
    reward_multiplier = Number(b.reward_multiplier)
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  const uuidOk = (s: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
  if (!uuidOk(missionId)) {
    return NextResponse.json({ error: 'missionId가 올바르지 않아요' }, { status: 400 })
  }
  if (![1, 2, 3].includes(reward_multiplier)) {
    return NextResponse.json({ error: '배율은 1, 2, 3 중 하나여야 해요' }, { status: 400 })
  }

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'parent') {
    return NextResponse.json({ error: '부모만 수정할 수 있어요' }, { status: 403 })
  }

  const { data: mission, error: mErr } = await supabase.from('missions').select('*').eq('id', missionId).maybeSingle()
  if (mErr || !mission) {
    return NextResponse.json({ error: '미션을 찾을 수 없어요' }, { status: 404 })
  }

  const m = mission as Mission
  if (!isSpecialSectionMission(m)) {
    return NextResponse.json({ error: '스페셜 미션만 보너스 배율을 바꿀 수 있어요' }, { status: 400 })
  }

  const childId = m.linked_child_id
  if (!childId) {
    return NextResponse.json({ error: '자녀 전용 스페셜만 설정할 수 있어요' }, { status: 403 })
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
    .update({ reward_multiplier })
    .eq('id', missionId)
    .select('*')
    .maybeSingle()

  if (upErr || !updated) {
    return NextResponse.json(
      { error: upErr?.message ?? '저장에 실패했어요' },
      { status: 500 },
    )
  }

  return NextResponse.json({ mission: updated as Mission })
}
