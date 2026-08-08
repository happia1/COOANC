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
import { createServiceRoleClient } from '@/lib/supabase/admin'
import {
  PRAISE_ASSET_STICKER_KEYS_ROW_HEART,
  PRAISE_ASSET_STICKER_KEYS_ROW_STAR,
} from '@/lib/praiseAssetStickers'

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

  // ── 배 이동 판정: 오늘 완료율 90% 이상 (실제 이동·하루 1회 게이트는 RPC가 행 잠금 안에서 처리) ──
  /** `daily_missions` 배정 열은 `date` 입니다(`assigned_date` 는 mission_logs 전용). */
  const { data: todayMissions } = await supabase
    .from('daily_missions')
    .select('id, is_completed')
    .eq('child_id', childId)
    .eq('date', completionDay)

  const totalToday = todayMissions?.length ?? 0
  const completedToday = (todayMissions?.filter((m) => m.is_completed).length ?? 0) + 1 // +1 낙관적
  const heartsFullToday = totalToday > 0 && completedToday / totalToday >= 0.9

  /**
   * 보상 반영은 121 RPC(complete_mission_reward)로 원자화합니다.
   * 행 잠금(FOR UPDATE) 안에서 증가·레벨업·스트릭·배 이동을 계산해,
   * 카드 연타(동시 요청) 시 같은 잔액을 읽고 서로 덮어쓰던 보상 유실(Lost Update)을 막습니다.
   */
  type AppliedReward = {
    credits: number
    hearts: number
    exp: number
    current_level: number
    exp_to_next_level: number
    streak_days: number
    total_credits_earned: number
    boat_advanced: boolean
  }
  let applied: AppliedReward | null = null

  const { data: rpcData, error: rpcErr } = await supabase.rpc('complete_mission_reward', {
    p_child_id: childId,
    p_credit: creditEarned,
    p_heart: heartEarned,
    p_exp: expEarned,
    p_completion_day: completionDay,
    p_advance_boat: heartsFullToday,
  })

  if (!rpcErr && rpcData && typeof rpcData === 'object') {
    const r = rpcData as Record<string, unknown>
    applied = {
      credits: readChildStatInt(r.credits),
      hearts: readChildStatInt(r.hearts),
      exp: readChildStatInt(r.exp),
      current_level: readChildStatInt(r.current_level),
      exp_to_next_level: readChildStatInt(r.exp_to_next_level),
      streak_days: readChildStatInt(r.streak_days),
      total_credits_earned: readChildStatInt(r.total_credits_earned),
      boat_advanced: r.boat_advanced === true,
    }
  } else if (rpcErr) {
    console.error('[daily-mission/complete] complete_mission_reward RPC 실패 — 레거시 경로 폴백', rpcErr.message)
  }

  if (!applied) {
    // ── 폴백 (121 마이그레이션 미적용 DB): 기존 read-modify-write — 동시 요청 시 보상 유실 가능
    let newExp = stats.exp + expEarned
    let newLevel = stats.current_level
    let newExpToNext = stats.exp_to_next_level
    while (newExpToNext > 0 && newExp >= newExpToNext) {
      newExp -= newExpToNext
      newLevel += 1
      newExpToNext = Math.max(1, Math.round(newExpToNext * 1.5))
    }

    const yesterday = addSeoulCalendarDays(completionDay, -1)
    let newStreak = stats.streak_days
    if (stats.last_mission_date !== completionDay) {
      newStreak = stats.last_mission_date === yesterday ? newStreak + 1 : 1
    }

    const baseCredits = readChildStatInt(stats.credits)
    const baseHearts = readChildStatInt(stats.hearts)
    const baseTotalCreditsEarned = readChildStatInt(stats.total_credits_earned)
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

    const { error: statsUpdateErr } = await supabase
      .from('child_stats')
      .update({
        /**
         * `credits_piggy` · `credits_wallet` 은 **일부러 건드리지 않습니다.**
         * 이 경로는 저금통을 관리하지 않는데도 요청 시작 시점에 읽어 둔 값을 다시 저장했습니다.
         * 아이가 저금통에 크레딧을 옮기는 도중(1개씩 약 2초 간격) 미션 완료가 끼면,
         * 그 사이에 들어간 저금이 예전 값으로 덮어써져 사라졌습니다(잃어버린 갱신).
         * 저금통을 바꾸는 곳은 옮기기(CAS)와 이자 정산뿐이어야 합니다.
         */
        credits: baseCredits + creditEarned,
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
    if (statsUpdateErr) {
      console.error('[daily-mission/complete] child_stats update failed', statsUpdateErr.message)
      return NextResponse.json({ error: '보상 저장에 실패했어요' }, { status: 500 })
    }

    applied = {
      credits: baseCredits + creditEarned,
      hearts: baseHearts + heartEarned,
      exp: newExp,
      current_level: newLevel,
      exp_to_next_level: newExpToNext,
      streak_days: newStreak,
      total_credits_earned: baseTotalCreditsEarned + creditEarned,
      boat_advanced: boatShouldAdvance,
    }
  }

  // ── 게임 트리거: 첫 미션 완료 ──
  const triggerResult = await fireGameTrigger(supabase, childId, 'FIRST_MISSION')

  /**
   * 하루 기준 칭찬 스티커 자동 발급 (랜덤 1개)
   * 비개발자 설명:
   *  - 오늘 끝낸 '일반 미션'이 10개가 되면 → 하트 스티커 5종 중 1개를 무작위로 지급
   *  - 오늘 끝낸 '스페셜 미션'이 5개가 되면 → 별 스티커 5종 중 1개를 무작위로 지급
   *  - 같은 날에는 각각 한 번만 지급되도록 `child_trigger_fired` 에 '날짜별 키'로 게이트를 겁니다.
   *    (다음 날이 되면 키가 달라지므로 자연히 초기화됩니다.)
   *  - `praise_sticker_grants` 정책상 parent_id 가 필요하므로 연결된 부모 1명을 찾아 service_role 로 삽입합니다.
   */
  let autoPraiseStickerGranted = false
  {
    // 스페셜(골드) 미션 템플릿 id 집합 — '일반/스페셜' 구분 기준으로 씁니다.
    const { data: specialMissionRows, error: specialMissionErr } = await supabase
      .from('missions')
      .select('id')
      .or('repeat_type.eq.event,difficulty.eq.special')
    if (specialMissionErr) {
      console.error('[daily-mission/complete] special mission ids error', specialMissionErr.message)
    }
    const specialIdSet = new Set((specialMissionRows ?? []).map((r) => r.id))

    // 오늘(배정일) 완료한 미션 로그 — 방금 완료한 미션도 위에서 이미 기록되어 포함됩니다.
    const { data: todayLogs, error: todayLogErr } = await supabase
      .from('mission_logs')
      .select('mission_id')
      .eq('child_id', childId)
      .eq('assigned_date', assignedDate)
      .eq('is_completed', true)
    if (todayLogErr) {
      console.error('[daily-mission/complete] today logs error', todayLogErr.message)
    }

    const logs = todayLogs ?? []
    const specialDoneToday = logs.filter((l) => specialIdSet.has(l.mission_id as string)).length
    const normalDoneToday = logs.length - specialDoneToday

    const wantNormalSticker = normalDoneToday >= 10
    const wantSpecialSticker = specialDoneToday >= 5

    if (wantNormalSticker || wantSpecialSticker) {
      const { data: familyLink, error: linkErr } = await supabase
        .from('family_links')
        .select('parent_id')
        .eq('child_id', childId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (linkErr) {
        console.error('[daily-mission/complete] family link for auto sticker error', linkErr.message)
      }

      const parentId = familyLink?.parent_id ?? null
      const svc = parentId ? createServiceRoleClient() : null
      if (parentId && !svc) {
        console.error('[daily-mission/complete] service role unavailable for auto sticker')
      }

      if (parentId && svc) {
        /** 후보 목록에서 무작위로 하나 고릅니다(스티커 종류 랜덤). */
        const pickRandom = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!

        const dailyGrants: { gateKey: string; spriteKey: string }[] = []
        if (wantNormalSticker) {
          dailyGrants.push({
            gateKey: `DAILY_NORMAL_STICKER:${completionDay}`,
            spriteKey: pickRandom(PRAISE_ASSET_STICKER_KEYS_ROW_HEART),
          })
        }
        if (wantSpecialSticker) {
          dailyGrants.push({
            gateKey: `DAILY_SPECIAL_STICKER:${completionDay}`,
            spriteKey: pickRandom(PRAISE_ASSET_STICKER_KEYS_ROW_STAR),
          })
        }

        for (const grant of dailyGrants) {
          /**
           * 하루 1회 게이트를 '선점'합니다. 같은 날 두 번째 호출은 PK 충돌(23505)로 막혀
           * 스티커가 중복 지급되지 않습니다. RLS 영향을 받지 않도록 service_role 로 삽입합니다.
           */
          const { data: gateRows, error: gateErr } = await svc
            .from('child_trigger_fired')
            .insert({ child_id: childId, trigger_key: grant.gateKey })
            .select('child_id')
          if (gateErr) {
            if (gateErr.code !== '23505') {
              console.error('[daily-mission/complete] daily sticker gate error', gateErr.message)
            }
            continue // 이미 오늘 지급됐거나(23505) 오류 → 지급 건너뜀
          }
          if (!gateRows?.length) continue

          const { error: grantErr } = await svc.from('praise_sticker_grants').insert({
            child_id: childId,
            parent_id: parentId,
            sprite_key: grant.spriteKey,
          })
          if (grantErr) {
            console.error('[daily-mission/complete] auto sticker grant failed', grantErr.message)
          } else {
            autoPraiseStickerGranted = true
          }
        }
      }
    }
  }

  return NextResponse.json({
    creditReward: creditEarned,
    heartReward: heartEarned,
    expReward: expEarned,
    rewardMultiplier,
    newLevel: applied.current_level,
    newExp: applied.exp,
    newExpToNext: applied.exp_to_next_level,
    newStreak: applied.streak_days,
    /** 클라이언트가 child_stats 를 서버와 동일하게 즉시 반영할 수 있게 함 (RPC 확정값) */
    newCredits: applied.credits,
    newHearts: applied.hearts,
    totalCreditsEarned: applied.total_credits_earned,
    boatAdvanced: applied.boat_advanced,
    itemUnlocked: triggerResult.fired && triggerResult.unlockedItemIndex !== null
      ? { index: triggerResult.unlockedItemIndex, triggerKey: 'FIRST_MISSION' }
      : null,
    autoPraiseStickerGranted,
  })
}
