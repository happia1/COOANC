import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { addSeoulCalendarDays } from '@/lib/koreaDate'
import { scaledMissionRewards } from '@/lib/missionRewardMultiplier'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import type { Mission } from '@/types/database'

/**
 * POST /api/daily-mission/complete
 * body: { dailyMissionId, today, childId? }
 * - 자녀 본인: childId 생략(또는 본인과 같음) — 적용 대상은 항상 로그인 사용자 id
 * - 부모 미리보기: childId 필수 — family_links 로 연결된 자녀만 처리
 *
 * 처리 순서:
 *  1. daily_missions 완료 표시
 *  2. mission_logs 반영
 *  3. child_stats (크레딧·EXP·스트릭 등) 갱신
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  let dailyMissionId: string
  let today: string
  let bodyChildId: unknown
  try {
    const body = await req.json()
    dailyMissionId = body.dailyMissionId
    today = body.today
    bodyChildId = body.childId
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!dailyMissionId || !today) {
    return NextResponse.json({ error: '필수 항목이 누락됐어요' }, { status: 400 })
  }

  const resolved = await resolveApiActorChildId(supabase, user, bodyChildId)
  if (resolved.ok === false) {
    return resolved.response
  }
  const childId = resolved.childId

  const { data: dm } = await supabase
    .from('daily_missions')
    .select('id, child_id, mission_template_id, is_completed, date')
    .eq('id', dailyMissionId)
    .eq('child_id', childId)
    .maybeSingle()

  if (!dm) return NextResponse.json({ error: '미션을 찾을 수 없어요' }, { status: 404 })
  if (dm.is_completed) return NextResponse.json({ error: '이미 완료한 미션이에요' }, { status: 409 })

  const { data: mission } = await supabase
    .from('missions')
    .select(
      'credit_reward, heart_reward, exp_reward, reward_multiplier, is_active, level_required, title, icon_emoji',
    )
    .eq('id', dm.mission_template_id)
    .maybeSingle()

  if (!mission || !mission.is_active) {
    return NextResponse.json({ error: '미션 템플릿을 찾을 수 없어요' }, { status: 404 })
  }

  const { credit: creditEarned, heart: heartEarned, exp: expEarned, mult: rewardMultiplier } =
    scaledMissionRewards(mission as Mission)

  const completedAt = new Date().toISOString()

  await supabase
    .from('daily_missions')
    .update({ is_completed: true, completed_at: completedAt })
    .eq('id', dailyMissionId)

  const { data: existingLog } = await supabase
    .from('mission_logs')
    .select('id, is_completed')
    .eq('child_id', childId)
    .eq('mission_id', dm.mission_template_id)
    .eq('assigned_date', today)
    .maybeSingle()

  const logData = {
    child_id: childId,
    mission_id: dm.mission_template_id,
    assigned_date: today,
    is_completed: true,
    completed_at: completedAt,
    credit_earned: creditEarned,
    heart_earned: heartEarned,
    exp_earned: expEarned,
  }
  if (existingLog) {
    await supabase.from('mission_logs').update(logData).eq('id', existingLog.id)
  } else {
    await supabase.from('mission_logs').insert(logData)
  }

  const { data: stats } = await supabase.from('child_stats').select('*').eq('child_id', childId).maybeSingle()

  if (!stats) return NextResponse.json({ error: '스탯 정보를 찾을 수 없어요' }, { status: 404 })

  let newExp = stats.exp + expEarned
  let newLevel = stats.current_level
  let newExpToNext = stats.exp_to_next_level
  let promoPending = stats.promotion_pending

  if (newExp >= newExpToNext && newLevel < 5) {
    newExp -= newExpToNext
    newLevel += 1
    newExpToNext = Math.round(newExpToNext * 1.5)
    if (newLevel === 5) promoPending = true
  }

  const yesterday = addSeoulCalendarDays(today, -1)
  let newStreak = stats.streak_days
  if (stats.last_mission_date !== today) {
    newStreak = stats.last_mission_date === yesterday ? newStreak + 1 : 1
  }

  await supabase
    .from('child_stats')
    .update({
      credits: stats.credits + creditEarned,
      hearts: stats.hearts + heartEarned,
      total_credits_earned: stats.total_credits_earned + creditEarned,
      exp: newExp,
      current_level: newLevel,
      exp_to_next_level: newExpToNext,
      streak_days: newStreak,
      longest_streak: Math.max(stats.longest_streak, newStreak),
      last_mission_date: today,
      promotion_pending: promoPending,
      updated_at: completedAt,
    })
    .eq('child_id', childId)

  return NextResponse.json({
    creditReward: creditEarned,
    heartReward: heartEarned,
    expReward: expEarned,
    rewardMultiplier,
    newLevel,
    newExp,
    newStreak,
  })
}
