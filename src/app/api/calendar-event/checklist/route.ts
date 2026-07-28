import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function parentOwnsEvent(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, allowed: false }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'parent') return { supabase, user, allowed: false }
  const { data: event } = await supabase.from('calendar_events').select('family_link_id').eq('id', eventId).maybeSingle()
  if (!event?.family_link_id) return { supabase, user, allowed: false }
  const { data: link } = await supabase.from('family_links').select('id').eq('id', event.family_link_id).eq('parent_id', user.id).maybeSingle()
  return { supabase, user, allowed: Boolean(link) }
}

export async function GET(req: NextRequest) {
  const eventId = new URL(req.url).searchParams.get('eventId')?.trim() ?? ''
  if (!UUID.test(eventId)) return NextResponse.json({ error: '일정 id가 올바르지 않아요' }, { status: 400 })
  const auth = await parentOwnsEvent(eventId)
  if (!auth.user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })
  if (!auth.allowed) return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })
  const db = createServiceRoleClient() ?? auth.supabase
  const { data, error } = await db.from('calendar_event_checklists').select('*').eq('calendar_event_id', eventId).order('sort_order')
  if (error) return NextResponse.json({ error: '체크리스트를 불러오지 못했어요' }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const eventId = String(body.eventId ?? '').trim()
  const title = String(body.title ?? '').trim().slice(0, 200)
  if (!UUID.test(eventId) || !title) return NextResponse.json({ error: '일정과 항목명을 확인해 주세요' }, { status: 400 })
  const auth = await parentOwnsEvent(eventId)
  if (!auth.user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })
  if (!auth.allowed) return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })
  const db = createServiceRoleClient() ?? auth.supabase
  const { data, error } = await db.from('calendar_event_checklists').insert({
    calendar_event_id: eventId,
    title,
    child_id: UUID.test(String(body.childId ?? '')) ? String(body.childId) : null,
    sort_order: Number.isInteger(body.sortOrder) ? Number(body.sortOrder) : 0,
  }).select().single()
  if (error) return NextResponse.json({ error: '체크리스트를 저장하지 못했어요' }, { status: 500 })
  return NextResponse.json({ item: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const eventId = String(body.eventId ?? '').trim()
  const itemId = String(body.itemId ?? '').trim()
  if (!UUID.test(eventId) || !UUID.test(itemId)) return NextResponse.json({ error: '항목 id가 올바르지 않아요' }, { status: 400 })
  const auth = await parentOwnsEvent(eventId)
  if (!auth.user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })
  if (!auth.allowed) return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })
  const completed = body.isCompleted === true
  const db = createServiceRoleClient() ?? auth.supabase
  const { error } = await db.from('calendar_event_checklists').update({ is_completed: completed, completed_at: completed ? new Date().toISOString() : null }).eq('id', itemId).eq('calendar_event_id', eventId)
  if (error) return NextResponse.json({ error: '체크 상태를 바꾸지 못했어요' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
