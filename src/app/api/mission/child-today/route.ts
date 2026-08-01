import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import { getSeoulDateString } from '@/lib/koreaDate'
import { fetchDailyRoutineOverride, resolveRoutineTypeForDay } from '@/lib/childRoutineCalendar'
import { templatePoolForMissionDay } from '@/lib/missionDayTemplatePool'
import type { DailyMissionWithTemplate, Mission } from '@/types/database'

const MISSION_JOIN =
  'title, icon_emoji, description, credit_reward, heart_reward, exp_reward, reward_multiplier, difficulty, block, repeat_type, sort_order'

/** 자녀 화면이 오늘 카드만 빠르게 동기화할 때 사용하는 전용 경로입니다. */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  let requestedChildId: unknown = null
  try {
    const body = (await req.json()) as { childId?: unknown }
    requestedChildId = body.childId
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }
  const actor = await resolveApiActorChildId(supabase, user, requestedChildId)
  if ('response' in actor) return actor.response

  const childId = actor.childId
  const today = getSeoulDateString()
  const db = createServiceRoleClient() ?? supabase

  const [templatesRes, profileRes, statsRes, existingRes, dailyOverride] = await Promise.all([
    db
      .from('missions')
      .select('*')
      .eq('linked_child_id', childId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('scheduled_time', { ascending: true, nullsFirst: false }),
    db.from('profiles').select('holiday_routine_mode').eq('id', childId).maybeSingle(),
    db.from('child_stats').select('current_level').eq('child_id', childId).maybeSingle(),
    db
      .from('daily_missions')
      .select(`*, missions:mission_template_id(${MISSION_JOIN})`)
      .eq('child_id', childId)
      .eq('date', today)
      .order('scheduled_time', { ascending: true, nullsFirst: false }),
    fetchDailyRoutineOverride(db, childId, today),
  ])

  const firstError = templatesRes.error ?? profileRes.error ?? statsRes.error ?? existingRes.error
  if (firstError) {
    console.error('[mission/child-today] initial query', firstError.message)
    return NextResponse.json({ error: '오늘의 미션을 불러오지 못했어요' }, { status: 503 })
  }

  const routineType = resolveRoutineTypeForDay(today, dailyOverride)
  const holidayMode = profileRes.data?.holiday_routine_mode as 'as_weekday' | 'custom' | null
  const pool = templatePoolForMissionDay(
    (templatesRes.data ?? []) as Mission[],
    childId,
    Number(statsRes.data?.current_level ?? 0),
    routineType,
    holidayMode,
  )
  let missions = (existingRes.data ?? []) as DailyMissionWithTemplate[]
  const existingIds = new Set(missions.map((row) => row.mission_template_id))
  const missing = pool.filter((mission) => !existingIds.has(mission.id))

  if (missing.length > 0) {
    const rows = missing.map((mission) => ({
      child_id: childId,
      mission_template_id: mission.id,
      date: today,
      scheduled_time: mission.scheduled_time ?? null,
      routine_type: routineType,
      is_completed: false,
    }))
    const inserted = await db.from('daily_missions').upsert(rows, {
      onConflict: 'child_id,date,mission_template_id',
      ignoreDuplicates: true,
    })
    if (inserted.error) {
      console.error('[mission/child-today] upsert', inserted.error.message)
      return NextResponse.json({ error: '오늘의 미션을 준비하지 못했어요' }, { status: 503 })
    }

    const refreshed = await db
      .from('daily_missions')
      .select(`*, missions:mission_template_id(${MISSION_JOIN})`)
      .eq('child_id', childId)
      .eq('date', today)
      .order('scheduled_time', { ascending: true, nullsFirst: false })
    if (refreshed.error) {
      console.error('[mission/child-today] refetch', refreshed.error.message)
      return NextResponse.json({ error: '오늘의 미션을 다시 불러오지 못했어요' }, { status: 503 })
    }
    missions = (refreshed.data ?? []) as DailyMissionWithTemplate[]
  }

  return NextResponse.json({
    ok: true,
    date: today,
    missions: missions.filter((mission) => mission.missions != null),
  })
}
