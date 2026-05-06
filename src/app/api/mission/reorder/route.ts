import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'

const uuidOk = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)

/**
 * POST /api/mission/reorder
 * 부모가 루틴 탭에서 드래그한 한 줄(가로 스트립)의 미션 id 순서를 `missions.sort_order`에 반영합니다.
 * — 모두 동일 `linked_child_id`인 템플릿만 갱신합니다(10, 20, 30… 스텝).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'parent') {
    return NextResponse.json({ error: '부모만 순서를 바꿀 수 있어요' }, { status: 403 })
  }

  let childId: string
  let orderedTemplateIds: string[]
  try {
    const b = await req.json()
    childId = String(b.childId ?? '').trim()
    if (!uuidOk(childId)) {
      return NextResponse.json({ error: 'childId가 올바르지 않아요' }, { status: 400 })
    }
    if (!Array.isArray(b.orderedTemplateIds) || b.orderedTemplateIds.length === 0) {
      return NextResponse.json({ error: 'orderedTemplateIds가 비었어요' }, { status: 400 })
    }
    orderedTemplateIds = b.orderedTemplateIds.map((x: unknown) => String(x).trim()).filter((s) => uuidOk(s))
    if (orderedTemplateIds.length === 0) {
      return NextResponse.json({ error: '올바른 미션 id가 없어요' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  const { data: link } = await supabase
    .from('family_links')
    .select('id')
    .eq('parent_id', user.id)
    .eq('child_id', childId)
    .maybeSingle()
  if (!link) {
    return NextResponse.json({ error: '이 자녀에 대한 권한이 없어요' }, { status: 403 })
  }

  const { data: rows, error: fetchErr } = await supabase
    .from('missions')
    .select('id, linked_child_id')
    .in('id', orderedTemplateIds)
  if (fetchErr) {
    console.error('[mission/reorder] select', fetchErr.message)
    return NextResponse.json({ error: '미션을 확인하지 못했어요' }, { status: 500 })
  }

  const byId = new Map((rows ?? []).map((r) => [r.id as string, r]))
  for (const id of orderedTemplateIds) {
    const row = byId.get(id)
    if (!row || row.linked_child_id !== childId) {
      return NextResponse.json(
        { error: '이 자녀 전용 미션만 같은 줄에서 순서를 바꿀 수 있어요' },
        { status: 400 },
      )
    }
  }

  const service = createServiceRoleClient()
  const db = service ?? supabase

  for (let i = 0; i < orderedTemplateIds.length; i++) {
    const id = orderedTemplateIds[i]!
    const sort_order = (i + 1) * 10
    const { error: upErr } = await db
      .from('missions')
      .update({ sort_order })
      .eq('id', id)
      .eq('linked_child_id', childId)
    if (upErr) {
      if (upErr.message?.includes('sort_order') || upErr.code === '42703' || upErr.code === 'PGRST204') {
        return NextResponse.json(
          {
            error:
              'DB에 missions.sort_order 컬럼이 없어요. supabase/migrations/072_missions_sort_order.sql 을 적용해 주세요.',
          },
          { status: 503 },
        )
      }
      console.error('[mission/reorder] update', id, upErr.message)
      return NextResponse.json({ error: '순서 저장에 실패했어요' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
