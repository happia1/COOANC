import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import { loadPlantPotStateForChild } from '@/lib/plantPotStateServer'

/**
 * GET /api/child/plant-pot-state?childId=
 * 재로그인·홈 진입 시 화분 상태를 서버(service role 우선)에서 한 번에 읽습니다.
 */
export async function GET(req: NextRequest) {
  try {
    const authSupabase = await createClient()
    const {
      data: { user },
    } = await authSupabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })
    }

    const queryChildId = req.nextUrl.searchParams.get('childId')
    const resolved = await resolveApiActorChildId(authSupabase, user, queryChildId)
    if (resolved.ok === false) return resolved.response

    const db = createServiceRoleClient() ?? authSupabase
    const loaded = await loadPlantPotStateForChild(db, resolved.childId)
    if (loaded.ok === false) {
      return NextResponse.json({ error: loaded.error }, { status: 500 })
    }

    return NextResponse.json({ ok: true, ...loaded.state })
  } catch (e) {
    console.error('[plant-pot-state] unexpected', e)
    return NextResponse.json({ error: '서버 오류가 발생했어요' }, { status: 500 })
  }
}
