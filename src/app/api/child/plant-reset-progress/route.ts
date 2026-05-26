import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'

/**
 * POST /api/child/plant-reset-progress
 * - `child_stats.hearts` 는 건드리지 않고, 화분 진행만 씨앗(0단계)으로 돌립니다.
 * - 클라이언트 RLS 로 pot_* 만 고치기 어려울 때·단계 값이 깨졌을 때 복구용입니다.
 *
 * 비개발자: 받은 하트 개수는 그대로 두고, 식물 그림만 다시 씨앗부터 자라게 맞춥니다.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })
    }

    let bodyChildId: unknown
    try {
      bodyChildId = (await req.json())?.childId
    } catch {
      bodyChildId = undefined
    }

    const resolved = await resolveApiActorChildId(supabase, user, bodyChildId)
    if (resolved.ok === false) return resolved.response
    const childId = resolved.childId

    const { data: after, error } = await supabase
      .from('child_stats')
      .update({
        pot_stage: 0,
        pot_hearts_used: 0,
        pot_completed: false,
      })
      .eq('child_id', childId)
      .select('hearts, pot_stage, pot_hearts_used, pot_completed')
      .maybeSingle()

    if (error) {
      console.error('[plant-reset-progress]', error.message)
      return NextResponse.json({ error: '화분 초기화에 실패했어요' }, { status: 500 })
    }
    if (!after) {
      return NextResponse.json({ error: '통계 행을 찾을 수 없어요' }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      hearts: after.hearts,
      pot_stage: after.pot_stage,
      pot_hearts_used: after.pot_hearts_used,
      pot_completed: after.pot_completed,
    })
  } catch (e) {
    console.error('[plant-reset-progress] unexpected', e)
    return NextResponse.json({ error: '서버 오류가 발생했어요' }, { status: 500 })
  }
}
