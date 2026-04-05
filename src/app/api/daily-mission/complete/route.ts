import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/daily-mission/complete
 * daily_missions 완료 처리:
 *  1. daily_missions.is_completed + completed_at 업데이트
 *  2. mission_logs INSERT (부모 앱 롤백 호환용)
 *  3. child_stats 업데이트 (크레딧·하트·EXP·스트릭)
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  let dailyMissionId: string
  let today: string
  try {
    ;({ dailyMissionId, today } = await req.json())
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!dailyMissionId || !today) {
    return NextResponse.json({ error: '필수 항목이 누락됐어요' }, { status: 400 })
  }

  // daily_mission 조회 (자녀 본인 소유 확인)
  const { data: dm } = await supabase
    .from('daily_missions')
    .select('id, child_id, mission_template_id, is_completed, date')
    .eq('id', dailyMissionId)
    .eq('child_id', user.id)
    .maybeSingle()

  if (!dm) return NextResponse.json({ error: '미션을 찾을 수 없어요' }, { status: 404 })
  if (dm.is_completed) return NextResponse.json({ error: '이미 완료한 미션이에요' }, { status: 409 })

  // 미션 템플릿 조회
  const { data: mission } = await supabase
    .from('missions')
    .select('credit_reward, heart_reward, exp_reward, is_active, level_required, title, icon_emoji')
    .eq('id', dm.mission_template_id)
    .maybeSingle()

  if (!mission || !mission.is_active) {
    return NextResponse.json({ error: '미션 템플릿을 찾을 수 없어요' }, { status: 404 })
  }

  const completedAt = new Date().toISOString()

  // 1. daily_missions 완료 처리
  await supabase
    .from('daily_missions')
    .update({ is_completed: true, completed_at: completedAt })
    .eq('id', dailyMissionId)

  // 2. mission_logs INSERT (부모 롤백 호환)
  const { data: existingLog } = await supabase
    .from('mission_logs')
    .select('id, is_completed')
    .eq('child_id', user.id)
    .eq('mission_id', dm.mission_template_id)
    .eq('assigned_date', today)
    .maybeSingle()

  const logData = {
    child_id:       user.id,
    mission_id:     dm.mission_template_id,
    assigned_date:  today,
    is_completed:   true,
    completed_at:   completedAt,
    credit_earned:  mission.credit_reward,
    heart_earned:   mission.heart_reward,
    exp_earned:     mission.exp_reward,
  }
  if (existingLog) {
    await supabase.from('mission_logs').update(logData).eq('id', existingLog.id)
  } else {
    await supabase.from('mission_logs').insert(logData)
  }

  // 3. child_stats 업데이트
  const { data: stats } = await supabase
    .from('child_stats')
    .select('*')
    .eq('child_id', user.id)
    .maybeSingle()

  if (!stats) return NextResponse.json({ error: '스탯 정보를 찾을 수 없어요' }, { status: 404 })

  let newExp        = stats.exp + mission.exp_reward
  let newLevel      = stats.current_level
  let newExpToNext  = stats.exp_to_next_level
  let promoPending  = stats.promotion_pending

  if (newExp >= newExpToNext && newLevel < 5) {
    newExp      -= newExpToNext
    newLevel    += 1
    newExpToNext = Math.round(newExpToNext * 1.5)
    if (newLevel === 5) promoPending = true
  }

  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]
  let newStreak = stats.streak_days
  if (stats.last_mission_date !== today) {
    newStreak = stats.last_mission_date === yesterday ? newStreak + 1 : 1
  }

  await supabase.from('child_stats').update({
    credits:              stats.credits + mission.credit_reward,
    hearts:               stats.hearts  + mission.heart_reward,
    total_credits_earned: stats.total_credits_earned + mission.credit_reward,
    exp:                  newExp,
    current_level:        newLevel,
    exp_to_next_level:    newExpToNext,
    streak_days:          newStreak,
    longest_streak:       Math.max(stats.longest_streak, newStreak),
    last_mission_date:    today,
    promotion_pending:    promoPending,
    updated_at:           completedAt,
  }).eq('child_id', user.id)

  return NextResponse.json({
    creditReward: mission.credit_reward,
    heartReward:  mission.heart_reward,
    expReward:    mission.exp_reward,
    newLevel,
    newExp,
    newStreak,
  })
}
