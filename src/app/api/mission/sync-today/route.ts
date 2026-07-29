import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { getSeoulDateString } from '@/lib/koreaDate'
import {
  fetchCalendarEventsForChildRoutine,
  fetchDailyRoutineOverride,
  resolveRoutineTypeForDay,
} from '@/lib/childRoutineCalendar'
import { templatePoolForMissionDay } from '@/lib/missionDayTemplatePool'
import type { Mission } from '@/types/database'

/**
 * POST /api/mission/sync-today
 * 부모의 루틴 저장이 전부 끝난 뒤, 새 템플릿 중 오늘 카드에 빠진 행만 보충합니다.
 * 기존 완료 행과 스페셜 행은 수정·삭제하지 않습니다.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  let childId = ''
  try {
    const body = (await req.json()) as { childId?: unknown }
    childId = typeof body.childId === 'string' ? body.childId.trim() : ''
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  const uuidOk =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(childId)
  if (!uuidOk) return NextResponse.json({ error: '자녀 id 형식이 올바르지 않아요' }, { status: 400 })

  const [{ data: profile }, { data: link }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabase
      .from('family_links')
      .select('id')
      .eq('parent_id', user.id)
      .eq('child_id', childId)
      .maybeSingle(),
  ])
  if (profile?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 동기화할 수 있어요' }, { status: 403 })
  }
  if (!link) {
    return NextResponse.json({ error: '연결된 자녀만 동기화할 수 있어요' }, { status: 403 })
  }

  const db = createServiceRoleClient() ?? supabase
  const today = getSeoulDateString()
  const [templatesRes, childProfileRes, statsRes, existingRes, calendarEvents, dailyRoutineOverride] = await Promise.all([
    db.from('missions').select('*').eq('linked_child_id', childId).eq('is_active', true),
    db.from('profiles').select('holiday_routine_mode').eq('id', childId).maybeSingle(),
    db.from('child_stats').select('current_level').eq('child_id', childId).maybeSingle(),
    db
      .from('daily_missions')
      .select('mission_template_id')
      .eq('child_id', childId)
      .eq('date', today),
    fetchCalendarEventsForChildRoutine(db, {
      today,
      childId,
      familyLinkId: link.id,
      parentId: user.id,
    }),
    fetchDailyRoutineOverride(db, childId, today),
  ])

  const firstError =
    templatesRes.error ?? childProfileRes.error ?? statsRes.error ?? existingRes.error
  if (firstError) {
    console.error('[mission/sync-today]', firstError)
    return NextResponse.json({ error: '오늘 미션을 불러오지 못했어요' }, { status: 500 })
  }

  const routineType = resolveRoutineTypeForDay(today, dailyRoutineOverride)
  const holidayMode = childProfileRes.data?.holiday_routine_mode as
    | 'as_weekday'
    | 'custom'
    | null
  const pool = templatePoolForMissionDay(
    (templatesRes.data ?? []) as Mission[],
    childId,
    Number(statsRes.data?.current_level ?? 0),
    routineType,
    holidayMode,
  )
  const existingIds = new Set(
    (existingRes.data ?? []).map((row) => String(row.mission_template_id)),
  )
  const rows = pool
    .filter((mission) => !existingIds.has(mission.id))
    .map((mission) => ({
      child_id: childId,
      mission_template_id: mission.id,
      date: today,
      scheduled_time: mission.scheduled_time ?? null,
      routine_type: routineType,
      is_completed: false,
    }))

  if (rows.length > 0) {
    const insertRes = await db.from('daily_missions').upsert(rows, {
      onConflict: 'child_id,date,mission_template_id',
      ignoreDuplicates: true,
    })
    if (insertRes.error) {
      console.error('[mission/sync-today] upsert', insertRes.error)
      return NextResponse.json({ error: '오늘 미션을 반영하지 못했어요' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, inserted: rows.length, date: today })
}
