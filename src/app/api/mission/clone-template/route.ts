import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'

/**
 * POST /api/mission/clone-template
 * 시스템 미션 풀(linked_child_id IS NULL) 행을 복제해 현재 자녀 전용 행을 만듭니다.
 * (아이콘·제목 등 시드와 동일하게 유지해 매칭 오류를 줄입니다.)
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  let templateId: string
  let childId: string
  try {
    const b = await req.json()
    templateId = String(b.templateId ?? '').trim()
    childId = String(b.childId ?? '').trim()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  const uuidOk = (s: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
  if (!uuidOk(templateId) || !uuidOk(childId)) {
    return NextResponse.json({ error: 'id 형식이 올바르지 않아요' }, { status: 400 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 추가할 수 있어요' }, { status: 403 })
  }

  const { data: link } = await supabase
    .from('family_links')
    .select('id')
    .eq('parent_id', user.id)
    .eq('child_id', childId)
    .maybeSingle()
  if (!link) {
    return NextResponse.json({ error: '연결된 자녀에게만 미션을 추가할 수 있어요' }, { status: 403 })
  }

  const service = createServiceRoleClient()
  const db = service ?? supabase

  const { data: tpl, error: tplErr } = await db.from('missions').select('*').eq('id', templateId).maybeSingle()
  if (tplErr || !tpl) {
    return NextResponse.json({ error: '미션 템플릿을 찾을 수 없어요' }, { status: 404 })
  }

  if (tpl.linked_child_id != null) {
    return NextResponse.json({ error: '시스템 미션만 목록에서 추가할 수 있어요' }, { status: 400 })
  }

  const title = String(tpl.title ?? '').trim()
  const { data: existing } = await db
    .from('missions')
    .select('id')
    .eq('linked_child_id', childId)
    .eq('title', title)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: '이미 이 자녀 루틴에 같은 이름의 미션이 있어요' }, { status: 409 })
  }

  const row = { ...tpl } as Record<string, unknown>
  delete row.id
  delete row.created_at
  row.linked_child_id = childId
  row.is_active = true

  const { data: created, error: insErr } = await db.from('missions').insert(row).select().single()
  if (insErr) {
    console.error('[mission/clone-template]', insErr)
    return NextResponse.json({ error: '미션 추가에 실패했어요' }, { status: 500 })
  }

  return NextResponse.json({ mission: created }, { status: 201 })
}
