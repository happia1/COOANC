import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'

/**
 * POST /api/calendar-event/delete
 * 부모가 캘린더 일정(서버 calendar_events) 한 건을 삭제합니다.
 */

const uuidOk = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 삭제할 수 있어요' }, { status: 403 })
  }

  let eventId: string
  try {
    const b = await req.json()
    eventId = String(b.eventId ?? '').trim()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!uuidOk(eventId)) {
    return NextResponse.json({ error: 'eventId가 올바르지 않아요' }, { status: 400 })
  }

  const { data: event, error: evErr } = await supabase
    .from('calendar_events')
    .select('id, family_link_id')
    .eq('id', eventId)
    .maybeSingle()

  if (evErr) {
    console.error('[calendar-event/delete] select', evErr.message)
    return NextResponse.json({ error: '일정을 찾지 못했어요' }, { status: 500 })
  }

  if (!event) {
    return NextResponse.json({ ok: true, alreadyGone: true }, { status: 200 })
  }

  const familyLinkId = event.family_link_id as string | null
  if (!familyLinkId || !uuidOk(familyLinkId)) {
    return NextResponse.json({ error: '삭제할 수 없는 일정이에요' }, { status: 403 })
  }

  const { data: link } = await supabase
    .from('family_links')
    .select('id')
    .eq('id', familyLinkId)
    .eq('parent_id', user.id)
    .maybeSingle()

  if (!link) {
    return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })
  }

  const service = createServiceRoleClient()
  const db = service ?? supabase

  const { error: sugErr } = await db.from('agent_suggestions').delete().eq('calendar_event_id', eventId)
  if (sugErr) {
    console.error('[calendar-event/delete] agent_suggestions', sugErr.message)
    return NextResponse.json({ error: '연결된 제안을 지우지 못했어요' }, { status: 500 })
  }

  const { error: delErr } = await db.from('calendar_events').delete().eq('id', eventId)
  if (delErr) {
    console.error('[calendar-event/delete] calendar_events', delErr.message)
    return NextResponse.json({ error: '삭제하지 못했어요' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
