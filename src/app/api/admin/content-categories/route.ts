import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient, serviceRoleEnvMissingMessage } from '@/lib/supabase/admin'
import { resolveContentAdminUser } from '@/lib/adminContentAccess'

async function requireAdmin() {
  const supabase = await createClient()
  const auth = await resolveContentAdminUser(supabase)
  if (auth.ok === false) {
    const status = auth.reason === 'unauthenticated' ? 401 : 403
    const error = auth.reason === 'unauthenticated' ? '인증이 필요해요' : '운영자 계정만 사용할 수 있어요'
    return { ok: false as const, response: NextResponse.json({ error }, { status }) }
  }
  return { ok: true as const }
}

function requireServiceRole() {
  const db = createServiceRoleClient()
  if (!db) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: `서버에 관리자 DB 접근키가 없어요. ${serviceRoleEnvMissingMessage()}` },
        { status: 500 },
      ),
    }
  }
  return { ok: true as const, db }
}

/** GET /api/admin/content-categories — 카테고리 전체(order_index 순) */
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const dbRes = requireServiceRole()
  if (!dbRes.ok) return dbRes.response

  const { data, error } = await dbRes.db
    .from('content_categories')
    .select('*')
    .order('order_index', { ascending: true })

  if (error) {
    console.error('[admin/content-categories:get]', error.message)
    return NextResponse.json({ error: '카테고리를 불러오지 못했어요' }, { status: 500 })
  }
  return NextResponse.json({ categories: data ?? [] })
}

/** POST /api/admin/content-categories — body: { key, label, orderIndex? } */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let key = ''
  let label = ''
  let orderIndex = 0
  try {
    const body = await req.json()
    key = typeof body.key === 'string' ? body.key.trim() : ''
    label = typeof body.label === 'string' ? body.label.trim() : ''
    orderIndex = Number.isFinite(Number(body.orderIndex)) ? Math.floor(Number(body.orderIndex)) : 0
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!/^[a-z0-9_]{2,40}$/.test(key)) {
    return NextResponse.json(
      { error: 'key 는 영문 소문자·숫자·밑줄만, 2~40자로 입력해 주세요 (예: self_regulation)' },
      { status: 400 },
    )
  }
  if (!label || label.length > 40) {
    return NextResponse.json({ error: '카테고리 이름을 확인해 주세요' }, { status: 400 })
  }

  const dbRes = requireServiceRole()
  if (!dbRes.ok) return dbRes.response

  const { data, error } = await dbRes.db
    .from('content_categories')
    .insert({ key, label, order_index: orderIndex })
    .select('*')
    .single()

  if (error) {
    console.error('[admin/content-categories:post]', error.message)
    const msg = error.code === '23505' ? '이미 있는 key 예요' : '카테고리를 추가하지 못했어요'
    return NextResponse.json({ error: msg }, { status: error.code === '23505' ? 409 : 500 })
  }
  return NextResponse.json({ category: data }, { status: 201 })
}

/** PATCH /api/admin/content-categories — body: { id, label?, orderIndex? } */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let id = ''
  let label: string | undefined
  let orderIndex: number | undefined
  try {
    const body = await req.json()
    id = typeof body.id === 'string' ? body.id : ''
    if (typeof body.label === 'string') label = body.label.trim()
    if (body.orderIndex !== undefined && Number.isFinite(Number(body.orderIndex))) {
      orderIndex = Math.floor(Number(body.orderIndex))
    }
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!id) return NextResponse.json({ error: '카테고리 정보가 필요해요' }, { status: 400 })
  if (label !== undefined && (!label || label.length > 40)) {
    return NextResponse.json({ error: '카테고리 이름을 확인해 주세요' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if (label !== undefined) patch.label = label
  if (orderIndex !== undefined) patch.order_index = orderIndex
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: '바꿀 내용이 없어요' }, { status: 400 })
  }

  const dbRes = requireServiceRole()
  if (!dbRes.ok) return dbRes.response

  const { data, error } = await dbRes.db
    .from('content_categories')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('[admin/content-categories:patch]', error.message)
    return NextResponse.json({ error: '카테고리를 저장하지 못했어요' }, { status: 500 })
  }
  return NextResponse.json({ category: data })
}

/** DELETE /api/admin/content-categories — body: { id } (그 카테고리를 쓰는 채널이 있으면 거절) */
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let id = ''
  try {
    const body = await req.json()
    id = typeof body.id === 'string' ? body.id : ''
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }
  if (!id) return NextResponse.json({ error: '카테고리 정보가 필요해요' }, { status: 400 })

  const dbRes = requireServiceRole()
  if (!dbRes.ok) return dbRes.response

  const { data: category } = await dbRes.db
    .from('content_categories')
    .select('key')
    .eq('id', id)
    .maybeSingle()
  if (!category) return NextResponse.json({ error: '카테고리를 찾을 수 없어요' }, { status: 404 })

  const { count } = await dbRes.db
    .from('content_channels')
    .select('id', { count: 'exact', head: true })
    .eq('category_key', category.key)
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: '이 카테고리를 쓰는 채널이 있어요. 채널을 먼저 다른 카테고리로 옮기거나 삭제해 주세요.' },
      { status: 409 },
    )
  }

  const { error } = await dbRes.db.from('content_categories').delete().eq('id', id)
  if (error) {
    console.error('[admin/content-categories:delete]', error.message)
    return NextResponse.json({ error: '카테고리를 삭제하지 못했어요' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id })
}
