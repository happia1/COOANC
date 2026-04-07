import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/mission/rollback
 * 부모가 자녀의 미션 완료를 미완료로 되돌립니다.
 * - 오늘 카드(daily_missions) · 로그(mission_logs) · 보상(child_stats)을 한꺼번에 맞춥니다.
 * - 응답의 dailyMissionId 로 자녀 앱이 브로드캐스트로 슬라이더 카드를 즉시 복구합니다.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  let missionLogId: string
  try {
    ;({ missionLogId } = await req.json())
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  // 부모 계정인지 확인합니다.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 롤백할 수 있어요' }, { status: 403 })
  }

  // 완료 로그 한 줄을 가져옵니다(템플릿·배정일로 daily_missions 행을 찾습니다).
  const { data: log, error: logFetchErr } = await supabase
    .from('mission_logs')
    .select('id, child_id, mission_id, assigned_date, is_completed, credit_earned, heart_earned, exp_earned')
    .eq('id', missionLogId)
    .maybeSingle()

  if (logFetchErr || !log) {
    return NextResponse.json({ error: '미션 로그를 찾을 수 없어요' }, { status: 404 })
  }

  if (!log.is_completed) {
    return NextResponse.json({ error: '이미 미완료 상태예요' }, { status: 409 })
  }

  // 연결된 자녀만 처리합니다.
  const { data: link } = await supabase
    .from('family_links')
    .select('id')
    .eq('parent_id', user.id)
    .eq('child_id', log.child_id)
    .maybeSingle()

  if (!link) {
    return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })
  }

  // DB date / API 문자열이 섞여 들어와도 YYYY-MM-DD 로 맞춥니다.
  const assignedDay =
    typeof log.assigned_date === 'string' ? log.assigned_date.slice(0, 10) : String(log.assigned_date ?? '')

  const { data: dm, error: dmFetchErr } = await supabase
    .from('daily_missions')
    .select('id')
    .eq('child_id', log.child_id)
    .eq('mission_template_id', log.mission_id)
    .eq('date', assignedDay)
    .maybeSingle()

  if (dmFetchErr || !dm) {
    return NextResponse.json({ error: '오늘의 미션 카드와 연결할 수 없어요' }, { status: 409 })
  }

  const { data: stats, error: statsErr } = await supabase
    .from('child_stats')
    .select('credits, hearts, exp, current_level, exp_to_next_level, total_credits_earned')
    .eq('child_id', log.child_id)
    .maybeSingle()

  if (statsErr || !stats) {
    return NextResponse.json({ error: '스탯 정보를 찾을 수 없어요' }, { status: 404 })
  }

  // 지급됐던 만큼만 빼 줍니다(미션 탭 클라이언트 롤백과 동일한 단순 차감).
  const newExp = Math.max(0, stats.exp - log.exp_earned)
  const newLevel = stats.current_level

  const { error: dmUpErr } = await supabase
    .from('daily_missions')
    .update({ is_completed: false, completed_at: null })
    .eq('id', dm.id)
    .eq('child_id', log.child_id)

  if (dmUpErr) {
    return NextResponse.json({ error: '일일 미션 되돌리기에 실패했어요' }, { status: 500 })
  }

  const { error: mlErr } = await supabase
    .from('mission_logs')
    .update({
      is_completed: false,
      completed_at: null,
      credit_earned: 0,
      heart_earned: 0,
      exp_earned: 0,
    })
    .eq('id', missionLogId)

  if (mlErr) {
    return NextResponse.json({ error: '미션 로그 되돌리기에 실패했어요' }, { status: 500 })
  }

  const { error: csErr } = await supabase
    .from('child_stats')
    .update({
      credits: Math.max(0, stats.credits - log.credit_earned),
      hearts: Math.max(0, stats.hearts - log.heart_earned),
      total_credits_earned: Math.max(0, stats.total_credits_earned - log.credit_earned),
      exp: newExp,
      current_level: newLevel,
      updated_at: new Date().toISOString(),
    })
    .eq('child_id', log.child_id)

  if (csErr) {
    return NextResponse.json({ error: '보상(크레딧·XP) 되돌리기에 실패했어요' }, { status: 500 })
  }

  return NextResponse.json({ success: true, dailyMissionId: dm.id })
}
