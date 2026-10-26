import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import { getHarvestFruitName, resolveTreeId } from '@/constants/plantTrees'

export async function GET(req: NextRequest) {
  return celebration(req, false)
}
export async function POST(req: NextRequest) {
  return celebration(req, true)
}
async function celebration(req: NextRequest, acknowledge: boolean) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })
  const body = acknowledge ? await req.json() : { childId: req.nextUrl.searchParams.get('childId') }
  const resolved = await resolveApiActorChildId(auth, user, body.childId)
  if (resolved.ok === false) return resolved.response
  const db = createServiceRoleClient()
  if (!db) return NextResponse.json({ error: '서버 설정을 확인해 주세요' }, { status: 503 })
  if (acknowledge) {
    const { error } = await db.from('child_action_receipts').update({ acknowledged_at: new Date().toISOString() })
      .eq('child_id', resolved.childId).eq('request_id', body.requestId).eq('kind', 'water')
    return NextResponse.json({ ok: !error }, { status: error ? 503 : 200 })
  }
  const { data, error } = await db.from('child_action_receipts').select('request_id,result')
    .eq('child_id', resolved.childId).eq('kind', 'water').is('acknowledged_at', null)
    .eq('result->>grew', 'true').order('created_at').limit(1).maybeSingle()
  if (error) return NextResponse.json({ error: '성장 결과를 확인하지 못했어요' }, { status: 503 })
  const result = data?.result
  if (result?.harvest) result.harvest.fruitName = getHarvestFruitName(resolveTreeId(result.harvest.fruitId))
  return NextResponse.json(data ? { requestId: data.request_id, newStage: result.newStage, harvest: result.harvest } : null,
    { headers: { 'Cache-Control': 'private, no-store' } })
}
