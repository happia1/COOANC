import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import { undoDailyMission } from '@/lib/undoDailyMission'
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
  let completionVersions: Record<string, number> = {}
  let requestIds: Record<string, string> = {}
  try {
    const body = await req.json()
    dailyMissionIds = body.dailyMissionIds
    bodyChildId = body.childId
    completionVersions = body.completionVersions ?? {}
    requestIds = body.requestIds ?? {}
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
    const r = await undoRecentCompletionForChild(supabase, childId, id, completionVersions[id], requestIds[id])
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
  version: number,
  requestId: string,
): Promise<UndoResult> {
  if (!Number.isInteger(version) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId ?? '')) return { status: 'err', message: '작업 정보를 새로 확인해 주세요' }
  const { data: dm, error: dmErr } = await supabase
    .from('daily_missions')
    .select('id, child_id, mission_template_id, date, is_completed, completed_at, completion_version')
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

  try {
    await undoDailyMission(childId, dm.id, version, requestId, true)
    return { status: 'undone' }
  } catch (error) {
    console.error('[undo-burst]', error)
    return { status: 'err', message: '미션을 되돌리지 못했어요. 상태를 새로 확인해 주세요.' }
  }
}
