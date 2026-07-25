import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'

/**
 * POST /api/calendar-event/update
 * 부모가 기존 캘린더 일정(서버 calendar_events)을 수정합니다(기기 간 동기화).
 * body: { eventId, title, startDate, endDate, eventType, routineOverride }
 *
 * - 권한: 해당 일정의 family_link 를 이 부모가 소유하는지 확인(delete 와 동일 패턴)
 * - 수정은 service_role 로 수행(054 RLS: 서버롤만 쓰기)
 */

const uuidOk = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)

const DB_EVENT_TYPES = new Set(['holiday', 'vacation', 'travel', 'birthday', 'etc', 'school'])
const DB_OVERRIDES = new Set(['weekend', 'none', 'weekday'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 수정할 수 있어요' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  const eventId = String(body.eventId ?? '').trim()
  const title = String(body.title ?? '').trim()
  const startDate = String(body.startDate ?? '').slice(0, 10)
  const endDateRaw = String(body.endDate ?? '').slice(0, 10)
  const endDate = DATE_RE.test(endDateRaw) ? endDateRaw : startDate
  const eventTypeRaw = String(body.eventType ?? 'etc').toLowerCase()
  const routineOverrideRaw = String(body.routineOverride ?? 'none').toLowerCase()

  if (!uuidOk(eventId)) {
    return NextResponse.json({ error: 'eventId가 올바르지 않아요' }, { status: 400 })
  }
  if (!title) {
    return NextResponse.json({ error: '일정 제목을 입력해주세요' }, { status: 400 })
  }
  if (!DATE_RE.test(startDate)) {
    return NextResponse.json({ error: '날짜 형식이 올바르지 않아요' }, { status: 400 })
  }

  const eventType = DB_EVENT_TYPES.has(eventTypeRaw) ? eventTypeRaw : 'etc'
  const routineOverride = DB_OVERRIDES.has(routineOverrideRaw) ? routineOverrideRaw : 'none'
  /** 빈 문자열 = 사용자가 설명을 지운 상태(다른 기기에도 그대로 반영) */
  const description = String(body.description ?? '').slice(0, 2000)

  // 대상 일정 + family_link 확인(권한)
  const { data: event } = await supabase
    .from('calendar_events')
    .select('id, family_link_id')
    .eq('id', eventId)
    .maybeSingle()

  if (!event) {
    // 서버에 없으면(로컬 전용 일정 등) 조용히 성공 처리 — 클라이언트는 localStorage 로 유지
    return NextResponse.json({ ok: true, notOnServer: true }, { status: 200 })
  }

  const familyLinkId = event.family_link_id as string | null
  if (!familyLinkId || !uuidOk(familyLinkId)) {
    return NextResponse.json({ error: '수정할 수 없는 일정이에요' }, { status: 403 })
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

  const base = {
    title,
    start_date: startDate,
    end_date: endDate,
    event_type: eventType,
    routine_override: routineOverride,
  }
  /**
   * description 은 126 마이그레이션에서 추가됩니다.
   * 아직 적용되지 않은 DB 에서는 이 필드를 보내면 전체 update 가 실패하므로,
   * 실패 시 설명 없이 재시도해 제목·날짜 수정은 정상 저장되게 합니다.
   */
  let { error: upErr } = await db
    .from('calendar_events')
    .update({ ...base, description })
    .eq('id', eventId)
  if (upErr) {
    const retry = await db.from('calendar_events').update(base).eq('id', eventId)
    if (!retry.error) {
      console.warn('[calendar-event/update] description 칼럼 없음 — 126 마이그레이션 필요')
      return NextResponse.json({ ok: true, descriptionSkipped: true }, { status: 200 })
    }
    upErr = retry.error
  }

  if (upErr) {
    console.error('[calendar-event/update]', upErr.message)
    return NextResponse.json({ error: '일정을 수정하지 못했어요' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
