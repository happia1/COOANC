import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ROUTINES = new Set(['weekday', 'weekend', 'holiday'])

async function parentLink(childId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, link: null }
  const { data: link } = await supabase.from('family_links').select('id').eq('parent_id', user.id).eq('child_id', childId).maybeSingle()
  return { supabase, link }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url); const childId = url.searchParams.get('childId') ?? ''; const date = url.searchParams.get('date') ?? ''
  if (!UUID.test(childId) || !DATE.test(date)) return NextResponse.json({ error: '날짜를 확인해 주세요' }, { status: 400 })
  const auth = await parentLink(childId); if (!auth.link) return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })
  const db = createServiceRoleClient() ?? auth.supabase
  const { data, error } = await db.from('daily_routine_overrides').select('routine_type,source_event_id').eq('child_id', childId).eq('routine_date', date).maybeSingle()
  if (error) return NextResponse.json({ error: '오늘의 루틴을 불러오지 못했어요' }, { status: 500 })
  return NextResponse.json({ override: data ?? null })
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const childId = String(body.childId ?? ''); const date = String(body.date ?? ''); const routineType = String(body.routineType ?? '')
  if (!UUID.test(childId) || !DATE.test(date) || !ROUTINES.has(routineType)) return NextResponse.json({ error: '루틴 정보를 확인해 주세요' }, { status: 400 })
  const auth = await parentLink(childId); if (!auth.link) return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })
  const db = createServiceRoleClient() ?? auth.supabase
  const sourceEventId = UUID.test(String(body.sourceEventId ?? '')) ? String(body.sourceEventId) : null
  const { error } = await db.from('daily_routine_overrides').upsert({ family_link_id: auth.link.id, child_id: childId, routine_date: date, routine_type: routineType, source_event_id: sourceEventId }, { onConflict: 'child_id,routine_date' })
  if (error) return NextResponse.json({ error: '오늘의 루틴을 저장하지 못했어요' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
