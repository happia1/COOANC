import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

/**
 * POST /api/child/delete
 * 부모가 자녀 프로필을 영구 삭제합니다.
 *
 * 처리 순서:
 * 1. 요청자가 로그인된 부모인지 확인
 * 2. family_links로 본인-해당 자녀 연결 여부 확인
 * 3. profiles.role === 'child' 검증 (부모 계정 등 오삭제 방지)
 * 4. Service role로 자녀 전용 미션 템플릿 정리: mission_logs → daily_missions → missions
 *    (DB에 FK CASCADE가 없어도 삭제되도록 순서 보장)
 * 5. family_links id로 calendar_events 행 조회 후 agent_suggestions → calendar_events 순 삭제(FK)·이후 보조 테이블 정리
 * 6. family_links · profiles 명시 삭제 후 auth.users 삭제(실패 시 로그만, DB 정리는 이미 완료)
 */
export async function POST(req: NextRequest) {
  let childId: string
  try {
    ;({ childId } = await req.json())
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 })
  }

  if (!childId) {
    return NextResponse.json({ error: 'childId가 누락됐어요.' }, { status: 400 })
  }

  // 1. 요청자 인증 확인
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: '인증되지 않은 요청이에요.' }, { status: 401 })
  }

  // 2. 요청자가 부모인지 확인
  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (me?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 삭제할 수 있어요.' }, { status: 403 })
  }

  // 3. family_links로 본인-자녀 연결 확인
  const { data: link } = await supabase
    .from('family_links')
    .select('id')
    .eq('parent_id', user.id)
    .eq('child_id', childId)
    .maybeSingle()

  if (!link) {
    return NextResponse.json({ error: '해당 자녀와 연결되어 있지 않아요.' }, { status: 403 })
  }

  // 4. 삭제 대상이 child 역할인지 확인 (부모 계정 오삭제 방지)
  const { data: childProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', childId)
    .maybeSingle()

  if (childProfile?.role !== 'child') {
    return NextResponse.json({ error: '자녀 계정만 삭제할 수 있어요.' }, { status: 403 })
  }

  // 서비스 롤 키가 없으면 Admin 클라이언트로 DB 정리·auth 삭제를 할 수 없음
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('[child/delete] SUPABASE_SERVICE_ROLE_KEY 또는 URL 누락')
    return NextResponse.json({ error: '서버 설정 오류로 삭제할 수 없어요.' }, { status: 500 })
  }

  const admin = createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 5a. 이 자녀 전용 미션 템플릿(id 목록) 조회 — 공용 풀(linked_child_id NULL)은 건드리지 않음
  const { data: childMissionRows, error: childMissionsErr } = await admin
    .from('missions')
    .select('id')
    .eq('linked_child_id', childId)

  if (childMissionsErr) {
    console.error('[child/delete] missions select:', childMissionsErr)
    return NextResponse.json({ error: '연결된 미션 정리 중 오류가 났어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
  }

  const templateIds = (childMissionRows ?? []).map((r) => r.id as string).filter(Boolean)

  // 5a-1. mission_logs / daily_missions 가 missions 를 참조할 때
  // DB에 마이그레이션 026(CASCADE)이 아직 없으면, missions 만 지우면 FK 오류가 남.
  // 그래서 자식 행을 먼저 지운 뒤 템플릿 행을 지움.
  if (templateIds.length > 0) {
    const { error: logsErr } = await admin.from('mission_logs').delete().in('mission_id', templateIds)
    if (logsErr) {
      console.error('[child/delete] mission_logs delete:', logsErr)
      return NextResponse.json({ error: '연결된 미션 정리 중 오류가 났어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
    }

    const { error: dailyErr } = await admin.from('daily_missions').delete().in('mission_template_id', templateIds)
    if (dailyErr) {
      console.error('[child/delete] daily_missions delete:', dailyErr)
      return NextResponse.json({ error: '연결된 미션 정리 중 오류가 났어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
    }
  }

  // 5a-2. 자녀에만 귀속된 미션 템플릿 행 제거
  const { error: missionDelErr } = await admin.from('missions').delete().eq('linked_child_id', childId)
  if (missionDelErr) {
    console.error('[child/delete] missions delete:', missionDelErr)
    return NextResponse.json({ error: '연결된 미션 정리 중 오류가 났어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
  }

  // 5b. 연결된 family_links id 목록 → agent_suggestions(일정 참조) → calendar_events 순으로 FK 정리
  const { data: familyLinkRows, error: familyLinksSelectErr } = await admin
    .from('family_links')
    .select('id')
    .eq('child_id', childId)

  if (familyLinksSelectErr) {
    console.error('[child/delete] family_links select:', familyLinksSelectErr)
    return NextResponse.json({ error: '연결 정보 정리 중 오류가 났어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
  }

  const familyLinkIds = (familyLinkRows ?? []).map((r) => r.id as string).filter(Boolean)

  if (familyLinkIds.length > 0) {
    // 5b-0. agent_suggestions 가 calendar_events 를 참조하므로, 일정 행을 먼저 id만 조회한 뒤 제안 삭제
    const { data: eventRows, error: eventsSelectErr } = await admin
      .from('calendar_events')
      .select('id')
      .in('family_link_id', familyLinkIds)

    if (eventsSelectErr) {
      console.error('[child/delete] calendar_events select (for agent_suggestions):', eventsSelectErr)
      return NextResponse.json({ error: '일정 데이터 정리 중 오류가 났어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
    }

    const eventIds = (eventRows ?? []).map((r) => r.id as string).filter(Boolean)
    if (eventIds.length > 0) {
      const { error: sugDelErr } = await admin.from('agent_suggestions').delete().in('calendar_event_id', eventIds)
      if (sugDelErr) {
        console.error('[child/delete] agent_suggestions delete:', sugDelErr)
        return NextResponse.json({ error: '일정 제안 정리 중 오류가 났어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
      }
    }

    // 5b-1. calendar_events — family_links 를 가리키는 일정 본문 삭제 (child_id 가 아닌 family_link_id 기준)
    const { error: calErr } = await admin.from('calendar_events').delete().in('family_link_id', familyLinkIds)
    if (calErr) {
      console.error('[child/delete] calendar_events delete:', calErr)
      return NextResponse.json({ error: '일정 데이터 정리 중 오류가 났어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
    }
  }

  // 5c. 자녀 id를 직접 담는 테이블을 FK 순서에 맞게 명시 삭제(없거나 RLS 무시 가능한 service role; 실패는 경고만)
  const cleanupByChildId = [
    'child_stats',
    'purchase_requests',
    'praise_sticker_logs',
    'credit_transactions',
    'market_hidden_items',
    'routine_alarms',
    'agent_reports',
    'weekly_reports',
  ] as const

  for (const table of cleanupByChildId) {
    const { error: cleanErr } = await admin.from(table).delete().eq('child_id', childId)
    if (cleanErr) {
      console.warn(`[child/delete] ${table} cleanup warn:`, cleanErr.message)
    }
  }

  // calendar_events 삭제 후에만 family_links 삭제 가능(남아 있는 행으로 FK 차단 방지)
  const { error: flDelErr } = await admin.from('family_links').delete().eq('child_id', childId)
  if (flDelErr) {
    console.error('[child/delete] family_links delete:', flDelErr)
    return NextResponse.json({ error: '가족 연결 정리 중 오류가 났어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
  }

  const { error: profileDelErr } = await admin.from('profiles').delete().eq('id', childId)
  if (profileDelErr) {
    console.error('[child/delete] profiles delete:', profileDelErr)
    return NextResponse.json({ error: '프로필 정리 중 오류가 났어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
  }

  // 5d. auth 사용자 삭제 — 위 DB 정리가 끝난 뒤; 실패해도 응답은 ok(관리자 콘솔에서 수동 삭제 안내 가능)
  const { error: deleteErr } = await admin.auth.admin.deleteUser(childId)
  if (deleteErr) {
    console.error('[child/delete] auth.admin.deleteUser error:', deleteErr)
    console.warn('[child/delete] DB 정리 완료, auth orphan 수동 처리 필요')
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
