import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import { fetchPlantHarvestInventory } from '@/lib/plantHarvest'

/**
 * GET /api/child/plant-harvest-inventory?childId=
 * 수확한 과일 목록 (종류별 개수)
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

    const bodyChildId = req.nextUrl.searchParams.get('childId')
    const resolved = await resolveApiActorChildId(authSupabase, user, bodyChildId)
    if (resolved.ok === false) return resolved.response

    const db = createServiceRoleClient() ?? authSupabase
    const items = await fetchPlantHarvestInventory(db, resolved.childId)

    return NextResponse.json({ items })
  } catch (e) {
    console.error('[plant-harvest-inventory] unexpected', e)
    return NextResponse.json({ error: '서버 오류가 발생했어요' }, { status: 500 })
  }
}
