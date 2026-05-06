import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { addSeoulCalendarDays, getSeoulDateString, getSeoulTimeHHMM } from '@/lib/koreaDate'
import {
  isAfternoonMissionFields,
  isBedtimeMissionBlockedBeforeSleepReadyWindow,
  isSeoulTimeBeforeNoon,
} from '@/lib/missionHonestyTiming'
import { scaledMissionRewards } from '@/lib/missionRewardMultiplier'
import { isSpecialSectionMission } from '@/lib/specialMissionChips'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import { readChildStatInt } from '@/lib/childCreditsSplit'
import type { Mission } from '@/types/database'
import { fireGameTrigger } from '@/lib/gameLayer/fireGameTrigger'

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

  if (!dm) {
    return NextResponse.json({ error: '미션을 찾을 수 없어요' }, { status: 404 })
  }
  if (dm.is_completed) {
    return NextResponse.json({ error: '이미 완료한 미션이에요' }, { status: 409 })
  }

  /** 보너스 배율(028) — 컬럼이 있으면 완료 보상에 곱합니다. */
  const { data: mission } = await supabase
    .from('missions')
    .select(
      'credit_reward, heart_reward, exp_reward, reward_multiplier, is_active, level_required, title, icon_emoji, block, scheduled_time, repeat_type, difficulty',
    )
    .eq('id', dm.mission_template_id)
    .maybeSingle()

  /**
   * 템플릿 행이 없으면(삭제·FK 불일치 등)만 막습니다.
   * 부모가 루틴에서 미션을 끈 뒤(is_active=false)에도 오늘 이미 배정된 daily_missions 는
   * 화면에 남을 수 있으므로, 그 경우에도 완료·보상 처리가 되게 합니다.
   */
  if (!mission) {
    return NextResponse.json({ error: '미션 템플릿을 찾을 수 없어요' }, { status: 404 })
  }

  const { credit: creditEarned, heart: heartEarned, exp: expEarned, mult: rewardMultiplier } =
    scaledMissionRewards(mission as Mission)

  const completedAt = new Date().toISOString()

  /** daily_missions.date 와 동일한 배정일을 써야 승인 탭 「오늘 완료」 필터·부모 목록과 일치합니다 */
  const assignedDate = dm.date
  /** 스트릭·last_mission_date 는 요청 body 의 today 가 아니라 실제 배정일 기준으로 맞춥니다 */
  const completionDay =
    typeof assignedDate === 'string' ? assignedDate.slice(0, 10) : String(assignedDate ?? '').slice(0, 10)

  const logData = {
    child_id: childId,
    mission_id: dm.mission_template_id,
    assigned_date: assignedDate,
    is_completed: true,
    completed_at: completedAt,
    credit_earned: creditEarned,
    heart_earned: heartEarned,
    exp_earned: expEarned,
  }

  /** 읽기만 먼저 병렬로 — `daily_missions` 완료 플래그는 반드시 성공한 뒤에만 로그·스탯을 씁니다(실패 시 DB만 어긋나는 버그 방지). */
  const [existingLogResult, statsPeek] = await Promise.all([
    supabase
      .from('mission_logs')
      .select('id, is_completed')
      .eq('child_id', childId)
      .eq('mission_id', dm.mission_template_id)
      .eq('assigned_date', assignedDate)
      .maybeSingle(),
    supabase.from('child_stats').select('*').eq('child_id', childId).maybeSingle(),
  ])

  const { data: actorProfile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const peekStats = statsPeek.data
  if (actorProfile?.role === 'child' && mission && peekStats) {
    const seoulNow = getSeoulTimeHHMM()
    const seoulToday = getSeoulDateString()
    /** 스페셜은 「정오 전 오후」 완료 제한만 면제 — 잠 준비 전 취침 미션 제한은 동일 */
    const skipAfternoonHonesty = isSpecialSectionMission(mission as Mission)
    const rawSr = typeof peekStats.sleep_ready_time === 'string' ? peekStats.sleep_ready_time.trim() : ''
    let sleepReadyNorm: string | null = null
    if (rawSr && /^\d{1,2}:\d{2}$/.test(rawSr)) {
      const [sh, sm] = rawSr.split(':')
      sleepReadyNorm = `${sh.padStart(2, '0')}:${sm.padStart(2, '0')}`
    }
    if (
      isBedtimeMissionBlockedBeforeSleepReadyWindow(mission.block, {
        sleepReadyHHMM: sleepReadyNorm,
        sleepReadyEnabled: peekStats.sleep_ready_time_enabled !== false,
        sleepReadyWeekday: peekStats.sleep_ready_time_weekday !== false,
        sleepReadyWeekend: peekStats.sleep_ready_time_weekend !== false,
        seoulDateYmd: seoulToday,
        seoulNowHHMM: seoulNow,
      })
    ) {
      return NextResponse.json(
        { error: '잠 준비 시간이 되기 전에는 이 미션을 끝낼 수 없어요.', code: 'honesty_bedtime' },
        { status: 403 },
      )
    }
    if (
      !skipAfternoonHonesty &&
      isAfternoonMissionFields(mission.block, mission.scheduled_time) &&
      isSeoulTimeBeforeNoon(seoulNow)
    ) {
      return NextResponse.json(
        { error: '오후 미션은 정오 이후에 완료할 수 있어요.', code: 'honesty_afternoon' },
        { status: 403 },
      )
    }
  }

  const { error: dmCompleteErr } = await supabase
    .from('daily_missions')
    .update({ is_completed: true, completed_at: completedAt })
    .eq('id', dailyMissionId)
  if (dmCompleteErr) {
    return NextResponse.json({ error: '미션 완료 상태를 저장하지 못했어요' }, { status: 500 })
  }

  const existingLog = existingLogResult.data
  const logWrite = existingLog
    ? supabase.from('mission_logs').update(logData).eq('id', existingLog.id)
    : supabase.from('mission_logs').insert(logData)

  const [{ error: logErr }, statsRes] = await Promise.all([logWrite, Promise.resolve(statsPeek)])
  if (logErr) {
    return NextResponse.json({ error: '미션 기록을 저장하지 못했어요' }, { status: 500 })
  }

  const { data: stats } = statsRes

  if (!stats) return NextResponse.json({ error: '스탯 정보를 찾을 수 없어요' }, { status: 404 })

  let newExp = stats.exp + expEarned
  let newLevel = stats.current_level
  let newExpToNext = stats.exp_to_next_level

  if (newExp >= newExpToNext && newLevel < 5) {
    newExp -= newExpToNext
    newLevel += 1
    newExpToNext = Math.round(newExpToNext * 1.5)
  }

  const yesterday = addSeoulCalendarDays(completionDay, -1)
  let newStreak = stats.streak_days
  if (stats.last_mission_date !== completionDay) {
    newStreak = stats.last_mission_date === yesterday ? newStreak + 1 : 1
  }

  /** 보상 크레딧은 총액만 증가 → 잔디(가용)에 쌓임. 지갑·저금통 숫자는 그대로 둡니다. */
  const keepWallet = readChildStatInt(stats.credits_wallet)
  const keepPiggy = readChildStatInt(stats.credits_piggy)
  const baseCredits = readChildStatInt(stats.credits)
  const baseHearts = readChildStatInt(stats.hearts)
  const baseTotalCreditsEarned = readChildStatInt(stats.total_credits_earned)

  // ── 배 이동: 오늘 완료율 90% 이상 + 오늘 첫 달성 시 boat_step 증가 ──
  /** `daily_missions` 배정 열은 `date` 입니다(`assigned_date` 는 mission_logs 전용). */
  const { data: todayMissions } = await supabase
    .from('daily_missions')
    .select('id, is_completed')
    .eq('child_id', childId)
    .eq('date', completionDay)

  const totalToday = todayMissions?.length ?? 0
  const completedToday = (todayMissions?.filter((m) => m.is_completed).length ?? 0) + 1 // +1 낙관적
  const heartsFullToday = totalToday > 0 && completedToday / totalToday >= 0.9
  const lastHeartsFullDate = (stats as Record<string, unknown>).last_hearts_full_date as string | null | undefined
  const boatShouldAdvance = heartsFullToday && lastHeartsFullDate !== completionDay

  const NAV_STEPS_PER_SECTION = 5
  const NAV_SECTION_COUNT = 4
  const currentBoatSection = ((stats as Record<string, unknown>).boat_section as number | undefined) ?? 0
  const currentBoatStep = ((stats as Record<string, unknown>).boat_step as number | undefined) ?? 0

  let newBoatSection = currentBoatSection
  let newBoatStep = currentBoatStep
  if (boatShouldAdvance) {
    newBoatStep = currentBoatStep + 1
    if (newBoatStep >= NAV_STEPS_PER_SECTION && newBoatSection < NAV_SECTION_COUNT - 1) {
      newBoatSection = currentBoatSection + 1
      newBoatStep = 0
    } else if (newBoatStep >= NAV_STEPS_PER_SECTION) {
      newBoatStep = NAV_STEPS_PER_SECTION - 1 // 마지막 섹션 마지막 칸에서 고정
    }
  }

  await supabase
    .from('child_stats')
    .update({
      credits: baseCredits + creditEarned,
      credits_wallet: keepWallet,
      credits_piggy: keepPiggy,
      hearts: baseHearts + heartEarned,
      total_credits_earned: baseTotalCreditsEarned + creditEarned,
      exp: newExp,
      current_level: newLevel,
      exp_to_next_level: newExpToNext,
      streak_days: newStreak,
      longest_streak: Math.max(stats.longest_streak, newStreak),
      last_mission_date: completionDay,
      promotion_pending: false,
      promotion_eligible_at: null,
      ...(boatShouldAdvance && {
        boat_section: newBoatSection,
        boat_step: newBoatStep,
        last_hearts_full_date: completionDay,
      }),
      updated_at: completedAt,
    })
    .eq('child_id', childId)

  // ── 게임 트리거: 첫 미션 완료 ──
  const triggerResult = await fireGameTrigger(supabase, childId, 'FIRST_MISSION')

  const newCredits = baseCredits + creditEarned
  const newHearts = baseHearts + heartEarned
  const newTotalEarned = baseTotalCreditsEarned + creditEarned

  return NextResponse.json({
    creditReward: creditEarned,
    heartReward: heartEarned,
    expReward: expEarned,
    rewardMultiplier,
    newLevel,
    newExp,
    newExpToNext,
    newStreak,
    /** 클라이언트가 child_stats 를 서버와 동일하게 즉시 반영할 수 있게 함 */
    newCredits,
    newHearts,
    totalCreditsEarned: newTotalEarned,
    boatAdvanced: boatShouldAdvance,
    itemUnlocked: triggerResult.fired && triggerResult.unlockedItemIndex !== null
      ? { index: triggerResult.unlockedItemIndex, triggerKey: 'FIRST_MISSION' }
      : null,
  })
}
