import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/mission/rollback
 * 부모가 자녀의 미션 완료를 미완료로 되돌림 (크레딧·하트·EXP 회수)
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

  // 부모 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 롤백할 수 있어요' }, { status: 403 })
  }

  // mission_log 조회
  const { data: log } = await supabase
    .from('mission_logs')
    .select('id, child_id, is_completed, credit_earned, heart_earned, exp_earned')
    .eq('id', missionLogId)
    .maybeSingle()

  if (!log) {
    return NextResponse.json({ error: '미션 로그를 찾을 수 없어요' }, { status: 404 })
  }

  if (!log.is_completed) {
    return NextResponse.json({ error: '이미 미완료 상태예요' }, { status: 409 })
  }

  // family_links 검증
  const { data: link } = await supabase
    .from('family_links')
    .select('id')
    .eq('parent_id', user.id)
    .eq('child_id', log.child_id)
    .maybeSingle()

  if (!link) {
    return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })
  }

  // child_stats 조회
  const { data: stats } = await supabase
    .from('child_stats')
    .select('credits, hearts, exp, current_level, exp_to_next_level, total_credits_earned')
    .eq('child_id', log.child_id)
    .maybeSingle()

  if (!stats) {
    return NextResponse.json({ error: '스탯 정보를 찾을 수 없어요' }, { status: 404 })
  }

  // EXP 회수 (레벨다운 포함)
  let newExp = Math.max(0, stats.exp - log.exp_earned)
  let newLevel = stats.current_level

  if (newExp < 0 && newLevel > 0) {
    newLevel -= 1
    newExp = Math.max(0, stats.exp_to_next_level - log.exp_earned)
  }

  // 미션 롤백
  await supabase
    .from('mission_logs')
    .update({
      is_completed: false,
      completed_at: null,
      credit_earned: 0,
      heart_earned: 0,
      exp_earned: 0,
    })
    .eq('id', missionLogId)

  // 스탯 차감
  await supabase
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

  return NextResponse.json({ success: true })
}
