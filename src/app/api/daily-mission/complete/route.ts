import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSeoulDateString, getSeoulTimeHHMM } from '@/lib/koreaDate'
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
 * 완료·로그·보상은 동일한 DB 트랜잭션에서 기록하고, 같은 작업은 추가 지급 없이 재확인합니다.
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
  let requestId: string
  let completionVersion: number
  try {
    const body = await req.json()
    dailyMissionId = body.dailyMissionId
    today = body.today
    bodyChildId = body.childId
    requestId = body.requestId
    completionVersion = body.completionVersion
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!dailyMissionId || !today || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId ?? '') || !Number.isInteger(completionVersion) || completionVersion < 0) {
    return NextResponse.json({ error: '필수 항목이 누락됐어요' }, { status: 400 })
  }

  const resolved = await resolveApiActorChildId(supabase, user, bodyChildId)
  if (resolved.ok === false) {
    return resolved.response
  }
  const childId = resolved.childId

  /**
   * 서로 필요 없는 조회는 **동시에** 보냅니다.
   *
   * 비개발자 설명: 예전에는 카드를 한 번 누를 때마다 데이터베이스에 한 번씩 차례로 물어봤습니다.
   * 하나에 0.2초라도 줄줄이 더해져서 「저장 중」이 길어졌습니다. 서로 결과를 기다릴 필요가 없는
   * 질문은 한꺼번에 보내면 가장 느린 하나만큼만 걸립니다.
   */
  const [dmRes, actorProfileRes, statsPeek] = await Promise.all([
    supabase
      .from('daily_missions')
      .select('id, child_id, mission_template_id, is_completed, date')
      .eq('id', dailyMissionId)
      .eq('child_id', childId)
      .maybeSingle(),
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabase.from('child_stats').select('*').eq('child_id', childId).maybeSingle(),
  ])

  const dm = dmRes.data
  if (!dm) {
    return NextResponse.json({ error: '미션을 찾을 수 없어요' }, { status: 404 })
  }


  /**
   * 시간 제한 검증용 템플릿을 읽습니다. 실제 지급액은 트랜잭션 안에서 다시 계산합니다.
   * 보너스 배율(028) — 컬럼이 있으면 완료 보상에 곱합니다.
   */
  const missionRes = await supabase.from('missions').select(
    'credit_reward, heart_reward, exp_reward, reward_multiplier, is_active, level_required, title, icon_emoji, block, scheduled_time, repeat_type, difficulty',
  ).eq('id', dm.mission_template_id).maybeSingle()

  const mission = missionRes.data

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

  /** daily_missions.date 와 동일한 배정일을 써야 승인 탭 「오늘 완료」 필터·부모 목록과 일치합니다 */
  const assignedDate = dm.date
  /** 스트릭·last_mission_date 는 요청 body 의 today 가 아니라 실제 배정일 기준으로 맞춥니다 */
  const completionDay =
    typeof assignedDate === 'string' ? assignedDate.slice(0, 10) : String(assignedDate ?? '').slice(0, 10)

  const actorProfile = actorProfileRes.data
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

  const service = createServiceRoleClient()
  if (!service) return NextResponse.json({ error: '보상 서버 설정을 확인해 주세요' }, { status: 503 })
  const { data: result, error: actionError } = await service.rpc('apply_daily_mission_action', {
    p_child_id: childId, p_daily_id: dailyMissionId, p_request_id: requestId,
    p_version: completionVersion, p_undo: false,
  })
  if (actionError || !result?.stats) {
    console.error('[daily-mission/complete]', actionError)
    return NextResponse.json({ error: '보상을 확인하지 못했어요. 다시 시도해 주세요.', code: actionError?.message },
      { status: actionError?.message.includes('STALE_COMPLETION') ? 409 : 503 })
  }
  const applied = { ...result.stats, boat_advanced: result.reward?.boat_advanced === true }
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
           * 하루 1회 게이트를 선점하고 중복은 오류 없이 무시합니다.
           * RLS 영향을 받지 않도록 service_role 로 삽입합니다.
           */
          const { data: gateRows, error: gateErr } = await svc
            .from('child_trigger_fired')
            .upsert({ child_id: childId, trigger_key: grant.gateKey }, {
              onConflict: 'child_id,trigger_key',
              ignoreDuplicates: true,
            })
            .select('child_id')
          if (gateErr) {
            console.error('[daily-mission/complete] daily sticker gate error', gateErr.message)
            continue
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
    requestId,
    completionVersion: result.completionVersion,
    alreadyCompleted: result.alreadyCompleted === true,
    creditReward: result.creditReward ?? creditEarned,
    heartReward: result.heartReward ?? heartEarned,
    expReward: result.expReward ?? expEarned,
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
