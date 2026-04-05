import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { addSeoulCalendarDays } from '@/lib/koreaDate'

/**
 * POST /api/mission/complete
 * 미션 완료 처리: mission_logs 생성 + child_stats 업데이트
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  let missionId: string, today: string
  try {
    ;({ missionId, today } = await req.json())
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!missionId || !today) {
    return NextResponse.json({ error: '필수 항목이 누락됐어요' }, { status: 400 })
  }

  // 미션 정보 조회
  const { data: mission } = await supabase
    .from('missions')
    .select('credit_reward, heart_reward, exp_reward, is_active, level_required')
    .eq('id', missionId)
    .maybeSingle()

  if (!mission || !mission.is_active) {
    return NextResponse.json({ error: '미션을 찾을 수 없어요' }, { status: 404 })
  }

  // 오늘 이미 완료했는지 확인
  const { data: existing } = await supabase
    .from('mission_logs')
    .select('id, is_completed')
    .eq('child_id', user.id)
    .eq('mission_id', missionId)
    .eq('assigned_date', today)
    .maybeSingle()

  if (existing?.is_completed) {
    return NextResponse.json({ error: '오늘 이미 완료한 미션이에요' }, { status: 409 })
  }

  // mission_log 생성 또는 업데이트
  const logData = {
    child_id: user.id,
    mission_id: missionId,
    assigned_date: today,
    is_completed: true,
    completed_at: new Date().toISOString(),
    credit_earned: mission.credit_reward,
    heart_earned: mission.heart_reward,
    exp_earned: mission.exp_reward,
  }

  if (existing) {
    await supabase.from('mission_logs').update(logData).eq('id', existing.id)
  } else {
    await supabase.from('mission_logs').insert(logData)
  }

  // child_stats 조회
  const { data: stats } = await supabase
    .from('child_stats')
    .select('*')
    .eq('child_id', user.id)
    .maybeSingle()

  if (!stats) {
    return NextResponse.json({ error: '스탯 정보를 찾을 수 없어요' }, { status: 404 })
  }

  // EXP · 레벨 계산
  let newExp = stats.exp + mission.exp_reward
  let newLevel = stats.current_level
  let newExpToNext = stats.exp_to_next_level
  let promotionPending = stats.promotion_pending

  if (newExp >= newExpToNext && newLevel < 5) {
    newExp -= newExpToNext
    newLevel += 1
    newExpToNext = Math.round(newExpToNext * 1.5)
    if (newLevel === 5) promotionPending = true
  }

  // 스트릭 계산
  const yesterday = addSeoulCalendarDays(today, -1)
  let newStreak = stats.streak_days
  if (stats.last_mission_date !== today) {
    newStreak = stats.last_mission_date === yesterday ? newStreak + 1 : 1
  }

  await supabase
    .from('child_stats')
    .update({
      credits: stats.credits + mission.credit_reward,
      hearts: stats.hearts + mission.heart_reward,
      total_credits_earned: stats.total_credits_earned + mission.credit_reward,
      exp: newExp,
      current_level: newLevel,
      exp_to_next_level: newExpToNext,
      streak_days: newStreak,
      longest_streak: Math.max(stats.longest_streak, newStreak),
      last_mission_date: today,
      promotion_pending: promotionPending,
      updated_at: new Date().toISOString(),
    })
    .eq('child_id', user.id)

  return NextResponse.json({
    creditReward: mission.credit_reward,
    heartReward: mission.heart_reward,
    expReward: mission.exp_reward,
    newLevel,
    newExp,
    newStreak,
  })
}
