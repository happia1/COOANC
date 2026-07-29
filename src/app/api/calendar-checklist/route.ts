import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/

function storageError(error: { code?: string } | null, fallback: string) {
  return error?.code === '42P01' || error?.code === 'PGRST205'
    ? '체크리스트 데이터베이스 업데이트가 필요해요. 관리자에게 알려 주세요.'
    : fallback
}

async function parentFamily(childId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, familyIds: [] as string[] }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'parent') return { supabase, familyIds: [] as string[] }
  let query = supabase.from('family_links').select('id').eq('parent_id', user.id)
  if (childId && UUID.test(childId)) query = query.eq('child_id', childId)
  const { data } = await query
  return { supabase, familyIds: (data ?? []).map((row) => row.id as string) }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const startDate = url.searchParams.get('startDate') ?? ''
  const endDate = url.searchParams.get('endDate') ?? startDate
  const childId = url.searchParams.get('childId') ?? undefined
  if (!DATE.test(startDate) || !DATE.test(endDate)) return NextResponse.json({ error: '날짜를 확인해 주세요' }, { status: 400 })
  const auth = await parentFamily(childId)
  if (auth.familyIds.length === 0) return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })
  const db = createServiceRoleClient() ?? auth.supabase
  const { data, error } = await db.from('calendar_checklists').select('*').in('family_link_id', auth.familyIds).gte('checklist_date', startDate).lte('checklist_date', endDate).order('sort_order').order('created_at')
  if (error) return NextResponse.json({ error: storageError(error, '체크리스트를 불러오지 못했어요') }, { status: error.code === '42P01' || error.code === 'PGRST205' ? 503 : 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const checklistDate = String(body.checklistDate ?? '')
  const childId = String(body.childId ?? '')
  const title = String(body.title ?? '').trim().slice(0, 200)
  if (!DATE.test(checklistDate) || !title) return NextResponse.json({ error: '날짜와 내용을 확인해 주세요' }, { status: 400 })
  const auth = await parentFamily(childId)
  if (auth.familyIds.length !== 1) return NextResponse.json({ error: '연결된 자녀를 확인해 주세요' }, { status: 403 })
  const db = createServiceRoleClient() ?? auth.supabase
  const { data, error } = await db.from('calendar_checklists').insert({ family_link_id: auth.familyIds[0], child_id: UUID.test(childId) ? childId : null, checklist_date: checklistDate, title, sort_order: Number.isInteger(body.sortOrder) ? Number(body.sortOrder) : 0 }).select().single()
  if (error) return NextResponse.json({ error: storageError(error, '체크리스트를 저장하지 못했어요') }, { status: error.code === '42P01' || error.code === 'PGRST205' ? 503 : 500 })
  return NextResponse.json({ item: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const id = String(body.id ?? '')
  if (!UUID.test(id)) return NextResponse.json({ error: '체크리스트를 확인해 주세요' }, { status: 400 })
  const auth = await parentFamily()
  if (auth.familyIds.length === 0) return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })
  const db = createServiceRoleClient() ?? auth.supabase
  const completed = body.isCompleted === true
  const { error } = await db.from('calendar_checklists').update({ is_completed: completed, completed_at: completed ? new Date().toISOString() : null }).eq('id', id).in('family_link_id', auth.familyIds)
  if (error) return NextResponse.json({ error: storageError(error, '체크 상태를 바꾸지 못했어요') }, { status: error.code === '42P01' || error.code === 'PGRST205' ? 503 : 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id') ?? ''
  if (!UUID.test(id)) return NextResponse.json({ error: '체크리스트를 확인해 주세요' }, { status: 400 })
  const auth = await parentFamily()
  if (auth.familyIds.length === 0) return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })
  const db = createServiceRoleClient() ?? auth.supabase
  const { error } = await db.from('calendar_checklists').delete().eq('id', id).in('family_link_id', auth.familyIds)
  if (error) return NextResponse.json({ error: storageError(error, '체크리스트를 삭제하지 못했어요') }, { status: error.code === '42P01' || error.code === 'PGRST205' ? 503 : 500 })
  return NextResponse.json({ ok: true })
}
