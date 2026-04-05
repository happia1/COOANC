import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { buildAlarmDescription, parseAlarmFromMissionDescription } from '@/lib/missionAlarmDescription'

/**
 * PATCH /api/mission/patch-schedule
 * 자녀 전용 미션의 알림 시각·알람 파일(description JSON)을 수정합니다.
 * - scheduled_time 이 null 이면 알림 끔(description 도 비움)
 * - 켤 때 alarmFile 을 생략하면 기존 description 의 파일명을 유지
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  let missionId: string
  let scheduled_time: string | null
  let alarmFile: string | null | undefined
  try {
    const b = await req.json()
    missionId = String(b.missionId ?? '').trim()
    if (b.scheduled_time === null || b.scheduled_time === '') {
      scheduled_time = null
    } else if (typeof b.scheduled_time === 'string' && /^\d{2}:\d{2}$/.test(b.scheduled_time)) {
      scheduled_time = b.scheduled_time
    } else {
      return NextResponse.json({ error: '시각은 HH:MM 형식이거나 비워야 해요' }, { status: 400 })
    }
    if (b.alarmFile === undefined) alarmFile = undefined
    else if (b.alarmFile === null || b.alarmFile === '') alarmFile = null
    else alarmFile = String(b.alarmFile).trim()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  const uuidOk = (s: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
  if (!uuidOk(missionId)) {
    return NextResponse.json({ error: 'missionId가 올바르지 않아요' }, { status: 400 })
  }

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'parent') {
    return NextResponse.json({ error: '부모만 수정할 수 있어요' }, { status: 403 })
  }

  const { data: mission, error: mErr } = await supabase.from('missions').select('*').eq('id', missionId).maybeSingle()
  if (mErr || !mission) {
    return NextResponse.json({ error: '미션을 찾을 수 없어요' }, { status: 404 })
  }

  const childId = mission.linked_child_id as string | null
  if (!childId) {
    return NextResponse.json({ error: '자녀 전용 미션만 알람을 바꿀 수 있어요' }, { status: 403 })
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

  let nextDescription: string | null
  if (scheduled_time === null) {
    nextDescription = null
  } else {
    const prevFile = parseAlarmFromMissionDescription(mission.description as string | null).alarmFile
    const file = alarmFile === undefined ? prevFile : alarmFile
    nextDescription = buildAlarmDescription(file)
  }

  const service = createServiceRoleClient()
  const db = service ?? supabase
  const { data: updated, error: upErr } = await db
    .from('missions')
    .update({
      scheduled_time,
      description: nextDescription,
    })
    .eq('id', missionId)
    .select()
    .single()

  if (upErr) {
    console.error('[mission/patch-schedule]', upErr)
    return NextResponse.json({ error: '저장에 실패했어요' }, { status: 500 })
  }

  return NextResponse.json({ mission: updated }, { status: 200 })
}
