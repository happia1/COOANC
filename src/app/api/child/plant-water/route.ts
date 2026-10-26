import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import { getHarvestFruitName, resolveTreeId } from '@/constants/plantTrees'

export async function POST(req: NextRequest) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })
  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: '요청 형식을 확인해 주세요' }, { status: 400 }) }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId ?? '')) return NextResponse.json({ error: '작업 ID가 필요해요' }, { status: 400 })
  const resolved = await resolveApiActorChildId(auth, user, body.childId)
  if (resolved.ok === false) return resolved.response
  const db = createServiceRoleClient()
  if (!db) return NextResponse.json({ error: '화분 서버 설정을 확인해 주세요' }, { status: 503 })
  const { data, error } = await db.rpc('water_child_plant', { p_child_id: resolved.childId, p_request_id: body.requestId })
  if (error || !data) {
    console.error('[plant-water]', error)
    return NextResponse.json({ error: '물주기 결과를 확인하지 못했어요. 다시 시도해 주세요.' }, { status: 503 })
  }
  if (data.harvest) data.harvest.fruitName = getHarvestFruitName(resolveTreeId(data.harvest.fruitId))
  return NextResponse.json(data, { status: data.ok ? 200 : 400 })
}
