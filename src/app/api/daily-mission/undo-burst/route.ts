import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import { applyChildCreditsCas } from '@/lib/childStatsCreditsCas'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * POST /api/daily-mission/undo-burst
 *
 * 비개발자 설명:
 * - 연속 탭(의심) 팝업에서 「미안.. 다시 할게」를 눌렀을 때, 방금 막 끝낸 미션(최대 4개)의
 *   완료·보상을 DB에서 되돌립니다.
 * - 부모의 `/api/mission/rollback` 과 같은 DB 규칙(일일 카드, 로그, 스탯 차감)을 따릅니다.
 * - "아주 예전" 완료는 막기 위해, 완료 시각이 짧은 시간(5분) 이내인 경우만 허용합니다.
 */
const MAX_BULK = 5
const RECENT_COMPLETE_WINDOW_MS = 5 * 60 * 1000

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  let dailyMissionIds: unknown
  let bodyChildId: unknown
  try {
    const body = await req.json()
    dailyMissionIds = body.dailyMissionIds
    bodyChildId = body.childId
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!Array.isArray(dailyMissionIds) || dailyMissionIds.length === 0) {
    return NextResponse.json({ error: '되돌릴 미션이 없어요' }, { status: 400 })
  }
  if (dailyMissionIds.length > MAX_BULK) {
    return NextResponse.json({ error: '한 번에 되돌릴 수 있는 미션 수를 초과했어요' }, { status: 400 })
  }

  const ids = Array.from(
    new Set(
      (dailyMissionIds as unknown[]).map((x) => String(x ?? '').trim()).filter(Boolean),
    ),
  ) as string[]

  if (ids.length === 0) {
    return NextResponse.json({ error: '유효한 미션 id 가 없어요' }, { status: 400 })
  }

  const resolved = await resolveApiActorChildId(supabase, user, bodyChildId)
  if (resolved.ok === false) {
    return resolved.response
  }
  const childId = resolved.childId

  const undone: string[] = []
  const failed: { id: string; error: string }[] = []

  for (const id of ids) {
    const r = await undoRecentCompletionForChild(supabase, childId, id)
    if (r.status === 'undone') {
      undone.push(id)
    } else if (r.status === 'skip') {
      // 이미 미완료면 클라·서버 맞추기용으로 조용히 통과
      undone.push(id)
    } else {
      failed.push({ id, error: r.message })
    }
  }

  return NextResponse.json({
    success: failed.length === 0,
    undone,
    failed: failed.length > 0 ? failed : undefined,
  })
}

type UndoResult =
  | { status: 'undone' }
  | { status: 'skip' }
  | { status: 'err'; message: string }

/**
 * daily_mission 한 건에 대해 완료/보상을 취소합니다(자녀 본인 행만).
 * 부모 `mission/rollback` 과 동일한 테이블 업데이트 순서를 유지합니다.
 */
async function undoRecentCompletionForChild(
  supabase: SupabaseClient,
  childId: string,
  dailyMissionId: string,
): Promise<UndoResult> {
  const { data: dm, error: dmErr } = await supabase
    .from('daily_missions')
    .select('id, child_id, mission_template_id, date, is_completed, completed_at')
    .eq('id', dailyMissionId)
    .eq('child_id', childId)
    .maybeSingle()

  if (dmErr || !dm) {
    return { status: 'err', message: '미션을 찾을 수 없어요' }
  }

  if (!dm.is_completed) {
    return { status: 'skip' }
  }

  const completedAt = dm.completed_at
    ? new Date(String(dm.completed_at))
    : null
  if (!completedAt || Number.isNaN(completedAt.getTime())) {
    return { status: 'err', message: '완료 시각을 확인할 수 없어요' }
  }
  if (Date.now() - completedAt.getTime() > RECENT_COMPLETE_WINDOW_MS) {
    return { status: 'err', message: '최근에 끝낸 미션만 취소할 수 있어요' }
  }

  const assignedDate = (dm as { date: string | null }).date

  const { data: log, error: logErr } = await supabase
    .from('mission_logs')
    .select('id, is_completed, credit_earned, heart_earned, exp_earned')
    .eq('child_id', childId)
    .eq('mission_id', dm.mission_template_id)
    .eq('assigned_date', assignedDate)
    .maybeSingle()

  if (logErr || !log) {
    return { status: 'err', message: '미션 기록을 찾을 수 없어요' }
  }

  if (!log.is_completed) {
    return { status: 'err', message: '이미 취소된 기록이에요' }
  }

  const { data: stats, error: statsErr } = await supabase
    .from('child_stats')
    .select('credits, hearts, exp, current_level, exp_to_next_level, total_credits_earned')
    .eq('child_id', childId)
    .maybeSingle()

  if (statsErr || !stats) {
    return { status: 'err', message: '스탯 정보를 찾을 수 없어요' }
  }

  // 크레딧·하트·누적·경험치는 아래 CAS 안에서 최신 값 기준으로 다시 계산합니다.
  const newLevel = Number(stats.current_level)

  const { error: dmUpErr } = await supabase
    .from('daily_missions')
    .update({ is_completed: false, completed_at: null })
    .eq('id', dm.id)
    .eq('child_id', childId)

  if (dmUpErr) {
    return { status: 'err', message: '일일 미션 되돌리기에 실패했어요' }
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
    .eq('id', log.id)

  if (mlErr) {
    return { status: 'err', message: '미션 로그 되돌리기에 실패했어요' }
  }

  /**
   * 크레딧·하트 되돌리기는 **CAS**(읽은 값 그대로일 때만 저장)로 처리합니다.
   * 예전에는 읽어 둔 잔액으로 통째로 덮어써서, 그사이 들어온 다른 변경(미션 보상·저금통 등)이
   * 지워졌습니다(잃어버린 갱신).
   */
  const applied = await applyChildCreditsCas(
    supabase,
    childId,
    (current) => ({
      ok: true as const,
      credits: Math.max(0, current.credits - Number(log.credit_earned)),
      hearts: Math.max(0, current.hearts - Number(log.heart_earned)),
      totalEarned: Math.max(0, current.totalEarned - Number(log.credit_earned)),
      exp: Math.max(0, current.exp - Number(log.exp_earned)),
    }),
    { extraPatch: { current_level: newLevel } },
  )

  if (applied.ok === false) {
    return { status: 'err', message: '보상(크레딧·XP) 되돌리기에 실패했어요' }
  }

  /**
   * EQ 다시 계산 — 138 에서 `mission_logs` 트리거를 없앴으므로(크레딧이 오르내리던 원인)
   * 되돌리기 경로에서는 직접 부릅니다. 실패해도 되돌리기는 이미 끝났으므로 막지 않습니다.
   */
  const { error: eqErr } = await supabase.rpc('recalculate_eq', { p_child_id: childId })
  if (eqErr) {
    console.error('[undo-burst] recalculate_eq 실패(무시하고 진행)', eqErr.message)
  }

  return { status: 'undone' }
}
