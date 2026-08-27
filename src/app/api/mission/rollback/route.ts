import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { applyChildCreditsCas } from '@/lib/childStatsCreditsCas'

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
    .select('credits, hearts, exp, current_level, exp_to_next_level, total_credits_earned, sleep_session_locked_date')
    .eq('child_id', log.child_id)
    .maybeSingle()

  if (statsErr || !stats) {
    return NextResponse.json({ error: '스탯 정보를 찾을 수 없어요' }, { status: 404 })
  }

  /**
   * 자녀가 그날 전부 완주 후 수면 모드에 들어간 날이면, 같은 날짜의 미션은 되돌릴 수 없습니다.
   */
  const lockedDay =
    typeof stats.sleep_session_locked_date === 'string'
      ? stats.sleep_session_locked_date.slice(0, 10)
      : stats.sleep_session_locked_date != null
        ? String(stats.sleep_session_locked_date).slice(0, 10)
        : null
  if (lockedDay && lockedDay === assignedDay) {
    return NextResponse.json(
      {
        error:
          '자녀가 그날 미션을 모두 끝내고 수면 모드로 들어가서, 이 미션은 더 이상 되돌릴 수 없어요.',
        code: 'sleep_session_locked',
      },
      { status: 403 },
    )
  }

  // 지급됐던 만큼만 빼 줍니다(미션 탭 클라이언트 롤백과 동일한 단순 차감).
  // 크레딧·하트·누적·경험치는 아래 CAS 안에서 최신 값 기준으로 다시 계산합니다.
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

  /**
   * 크레딧·하트 되돌리기는 **CAS**(읽은 값 그대로일 때만 저장)로 처리합니다.
   *
   * 비개발자 설명: 예전에는 "지금 잔액을 읽어 → 뺀 값으로 통째로 덮어쓰기" 였습니다.
   * 그 사이에 아이가 미션을 하나 더 끝내거나 저금통을 옮기면, 그 결과가 옛 계산값에
   * 지워져 크레딧이 사라졌습니다. 이제는 값이 그사이 바뀌었으면 최신 값으로 다시 계산합니다.
   */
  const applied = await applyChildCreditsCas(
    supabase,
    log.child_id,
    (current) => ({
      ok: true as const,
      credits: Math.max(0, current.credits - log.credit_earned),
      hearts: Math.max(0, current.hearts - log.heart_earned),
      totalEarned: Math.max(0, current.totalEarned - log.credit_earned),
      exp: Math.max(0, current.exp - log.exp_earned),
    }),
    { extraPatch: { current_level: newLevel } },
  )

  if (applied.ok === false) {
    return NextResponse.json({ error: '보상(크레딧·XP) 되돌리기에 실패했어요' }, { status: 500 })
  }

  /**
   * EQ(루틴 완주율 등) 다시 계산 — 138 이전에는 `mission_logs` 트리거가 자동으로 했지만,
   * 그 트리거가 «보상 반영 전» child_stats 를 저장해 크레딧이 화면에서 오르내리게 만들어
   * 제거했습니다. 되돌리기 경로에서는 여기서 직접 부릅니다.
   * 실패해도 되돌리기 자체는 이미 끝났으므로 요청을 막지 않습니다.
   */
  const { error: eqErr } = await supabase.rpc('recalculate_eq', { p_child_id: log.child_id })
  if (eqErr) {
    console.error('[mission/rollback] recalculate_eq 실패(무시하고 진행)', eqErr.message)
  }

  return NextResponse.json({ success: true, dailyMissionId: dm.id })
}
