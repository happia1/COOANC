import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'

/**
 * POST /api/calendar-event/create
 * 부모가 만든 캘린더 일정을 서버 `calendar_events` 에 저장합니다(기기 간 동기화).
 * body: { childId, title, startDate, endDate, eventType, routineOverride }
 *
 * - 서버 INSERT 정책은 service_role 만 허용(054) → 부모 소유 family_link 확인 후 service_role 로 삽입.
 * - `event_type` DB 허용값(holiday/vacation/travel/birthday/etc/school) 외(local 전용 special/other/event)는 'etc' 로 보정.
 */

const uuidOk = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)

const DB_EVENT_TYPES = new Set(['holiday', 'vacation', 'travel', 'birthday', 'etc', 'school'])
const DB_OVERRIDES = new Set(['weekend', 'none', 'weekday'])
const RECUR_TYPES = new Set(['none', 'weekly', 'monthly', 'yearly'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 일정을 저장할 수 있어요' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  const childId = String(body.childId ?? '').trim()
  const title = String(body.title ?? '').trim()
  const startDate = String(body.startDate ?? '').slice(0, 10)
  const endDateRaw = String(body.endDate ?? '').slice(0, 10)
  const endDate = DATE_RE.test(endDateRaw) ? endDateRaw : startDate
  const eventTypeRaw = String(body.eventType ?? 'etc').toLowerCase()
  const routineOverrideRaw = String(body.routineOverride ?? 'none').toLowerCase()

  if (!uuidOk(childId)) {
    return NextResponse.json({ error: '자녀 정보가 올바르지 않아요' }, { status: 400 })
  }
  if (!title) {
    return NextResponse.json({ error: '일정 제목을 입력해주세요' }, { status: 400 })
  }
  if (!DATE_RE.test(startDate)) {
    return NextResponse.json({ error: '날짜 형식이 올바르지 않아요' }, { status: 400 })
  }

  const eventType = DB_EVENT_TYPES.has(eventTypeRaw) ? eventTypeRaw : 'etc'
  const routineOverride = DB_OVERRIDES.has(routineOverrideRaw) ? routineOverrideRaw : 'none'
  /** 빈 문자열 = 설명 없음(126 적용 DB 에서만 저장됨) */
  const description = String(body.description ?? '').slice(0, 2000)
  const categoryMain = String(body.categoryMain ?? '').trim().slice(0, 40) || null
  const categorySub = String(body.categorySub ?? '').trim().slice(0, 40) || null
  const isAllDay = body.isAllDay !== false
  const timeStart = isAllDay ? null : String(body.timeStart ?? '').slice(0, 5) || null
  const timeEnd = isAllDay ? null : String(body.timeEnd ?? '').slice(0, 5) || null
  const recurRaw = String(body.recurType ?? 'none').toLowerCase()
  const recurType = RECUR_TYPES.has(recurRaw) ? recurRaw : 'none'
  const recurUntilRaw = String(body.recurUntil ?? '').slice(0, 10)
  const recurUntil = recurType !== 'none' && DATE_RE.test(recurUntilRaw) ? recurUntilRaw : null

  /**
   * 이 부모–자녀의 family_link 확인(권한 검증).
   * 브라우저 세션의 RLS 상태에 기대면 기기별로 실제 연결을 못 읽어 403을 낼 수 있습니다.
   * 인증된 user.id를 조건으로 고정한 뒤 서버 권한으로 확인합니다.
   * 과거 중복 연결 행이 있어도 첫 행을 사용하도록 limit(1)을 둡니다.
   */
  const service = createServiceRoleClient()
  const db = service ?? supabase
  const { data: link, error: linkError } = await db
    .from('family_links')
    .select('id')
    .eq('parent_id', user.id)
    .eq('child_id', childId)
    .limit(1)
    .maybeSingle()

  if (linkError) {
    console.error('[calendar-event/create] family link lookup', linkError.message)
    return NextResponse.json({ error: '가족 연결을 확인하지 못했어요' }, { status: 500 })
  }
  if (!link) {
    return NextResponse.json({ error: '연결된 자녀의 일정만 저장할 수 있어요' }, { status: 403 })
  }

  const legacyBase = {
    family_link_id: link.id,
    event_type: eventType,
    title,
    start_date: startDate,
    end_date: endDate,
    routine_override: routineOverride,
  }
  const base = {
    ...legacyBase,
    category_main: categoryMain,
    category_sub: categorySub,
    is_all_day: isAllDay,
    time_start: timeStart,
    time_end: timeEnd,
    is_important: body.isImportant === true,
    place: String(body.place ?? '').trim().slice(0, 200) || null,
    notify_offset: String(body.notifyOffset ?? '').trim().slice(0, 40) || null,
    notify_custom_at: String(body.notifyCustomAt ?? '').trim() || null,
    recur_type: recurType,
    recur_until: recurUntil,
  }
  /**
   * description 은 126 마이그레이션에서 추가됩니다.
   * 미적용 DB 에서 insert 전체가 실패하지 않도록, 실패 시 설명 없이 재시도합니다.
   */
  let { data: inserted, error: insErr } = await db
    .from('calendar_events')
    .insert({ ...base, description })
    .select('id')
    .single()
  if (insErr) {
    const retry = await db.from('calendar_events').insert(legacyBase).select('id').single()
    if (!retry.error && retry.data) {
      console.warn('[calendar-event/create] description 칼럼 없음 — 126 마이그레이션 필요')
      return NextResponse.json({ id: retry.data.id }, { status: 201 })
    }
    insErr = retry.error
    inserted = retry.data
  }

  if (insErr || !inserted) {
    console.error('[calendar-event/create]', insErr?.message)
    return NextResponse.json({ error: '일정을 저장하지 못했어요' }, { status: 500 })
  }

  return NextResponse.json({ id: inserted.id }, { status: 201 })
}
