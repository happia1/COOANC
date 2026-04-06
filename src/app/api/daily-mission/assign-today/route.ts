import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { getSeoulDateString } from '@/lib/koreaDate'

/**
 * POST /api/daily-mission/assign-today
 * - event 스페셜: 오늘 하루만 daily_missions 행 추가
 * - daily + difficulty special: 매일 자동 스페셜 키워드 — 오늘 행이 없을 때(또는 중복 시) 동일하게 삽입 시도(23505 시 이미 있음)
 * service_role 키가 있으면 그걸로 삽입하고, 없으면 로그인 세션으로 삽입합니다.
 * (027 마이그레이션으로 부모 INSERT RLS 가 있으면 세션만으로도 성공합니다.)
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'parent') {
    return NextResponse.json({ error: '부모만 배정할 수 있어요' }, { status: 403 })
  }

  let body: { childId?: string; missionTemplateId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  const childId = typeof body.childId === 'string' ? body.childId.trim() : ''
  const missionTemplateId =
    typeof body.missionTemplateId === 'string' ? body.missionTemplateId.trim() : ''
  const uuidOk = (id: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  if (!uuidOk(childId) || !uuidOk(missionTemplateId)) {
    return NextResponse.json({ error: 'id 형식이 올바르지 않아요' }, { status: 400 })
  }

  const { data: link } = await supabase
    .from('family_links')
    .select('id')
    .eq('parent_id', user.id)
    .eq('child_id', childId)
    .maybeSingle()
  if (!link) {
    return NextResponse.json({ error: '연결된 자녀만 배정할 수 있어요' }, { status: 403 })
  }

  const { data: mission, error: mErr } = await supabase
    .from('missions')
    .select('id, repeat_type, linked_child_id, scheduled_time, is_active, difficulty')
    .eq('id', missionTemplateId)
    .maybeSingle()

  if (mErr || !mission) {
    return NextResponse.json({ error: '미션을 찾을 수 없어요' }, { status: 404 })
  }
  const isEventSpecial = mission.repeat_type === 'event'
  const isDailyAutoSpecial =
    mission.repeat_type === 'daily' && mission.difficulty === 'special'
  if (!isEventSpecial && !isDailyAutoSpecial) {
    return NextResponse.json(
      { error: '스페셜(이벤트) 또는 매일 스페셜 미션만 오늘 배정할 수 있어요' },
      { status: 400 },
    )
  }
  if (mission.linked_child_id !== childId) {
    return NextResponse.json({ error: '이 자녀 전용 스페셜 미션이 아니에요' }, { status: 403 })
  }
  if (!mission.is_active) {
    return NextResponse.json({ error: '비활성 미션은 배정할 수 없어요' }, { status: 400 })
  }

  const today = getSeoulDateString()
  const service = createServiceRoleClient()
  const db = service ?? supabase

  const row = {
    child_id: childId,
    mission_template_id: missionTemplateId,
    date: today,
    scheduled_time: mission.scheduled_time ?? null,
    routine_type: 'weekday' as const,
    is_completed: false,
  }

  const ins = await db.from('daily_missions').insert(row).select().single()
  if (ins.error) {
    if (ins.error.code === '23505') {
      return NextResponse.json({ ok: true, alreadyAssigned: true, date: today }, { status: 200 })
    }
    console.error('[daily-mission/assign-today]', ins.error)
    const errMsg = String(ins.error.message ?? '')
    const errCode = ins.error.code ?? ''
    // PGRST205(Supabase 문서): URI의 테이블을 스키마 캐시에서 찾지 못함 — RLS와 무관, 테이블 미생성/미노출/캐시가 흔한 원인
    const looksLikeTableMissingInApi =
      errCode === 'PGRST205' ||
      /could not find the table.*schema cache|not find the table.*in the schema cache/i.test(errMsg)
    // PostgREST/Postgres: RLS·권한 거부
    const looksLikeRlsOrPermission =
      errCode === '42501' ||
      /row-?level security|violates row-level|permission denied|\brls\b|policy for table/i.test(errMsg)
    const isDev = process.env.NODE_ENV === 'development'
    let hint = ''
    if (looksLikeTableMissingInApi) {
      hint =
        'Supabase API가 public.daily_missions 테이블을 찾지 못했어요(PGRST205). SQL Editor에서 to_regclass가 NULL이면 테이블이 없는 것이니, supabase/migrations/20240407_daily_missions_bootstrap_idempotent.sql 전체를 붙여 넣어 실행하거나(또는 20240406_daily_missions.sql), 그 뒤에도 같으면 프로젝트 재시작으로 스키마 캐시를 갱신해 보세요.'
    } else if (looksLikeRlsOrPermission) {
      hint =
        'DB에서 부모가 자녀「오늘 일정」을 넣는 권한이 없을 수 있어요. Supabase에 마이그레이션 027(부모 INSERT 정책)을 적용했는지 확인해 주세요. 서버에 SUPABASE_SERVICE_ROLE_KEY가 없으면 이 정책이 필요합니다.'
    } else if (isDev) {
      hint = `개발: insert 실패 (code=${errCode}). 터미널 로그의 전체 메시지를 확인해 주세요.`
    }
    // #region agent log
    fetch('http://127.0.0.1:7447/ingest/9dd0682d-d3af-41fb-8d82-be18fff89b7a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '2bd468' },
      body: JSON.stringify({
        sessionId: '2bd468',
        location: 'assign-today/route.ts:insertErr',
        message: 'daily_missions insert failed',
        data: {
          code: errCode,
          msgSlice: errMsg.slice(0, 220),
          looksLikeTableMissingInApi,
          looksLikeRlsOrPermission,
          usingServiceRole: !!service,
          isDev,
        },
        timestamp: Date.now(),
        hypothesisId: 'H-assign-insert',
      }),
    }).catch(() => {})
    // #endregion
    return NextResponse.json(
      {
        error: '오늘 일정에 넣지 못했어요',
        ...(hint ? { hint } : {}),
        ...(isDev ? { code: errCode } : {}),
      },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, dailyMission: ins.data, date: today }, { status: 201 })
}
