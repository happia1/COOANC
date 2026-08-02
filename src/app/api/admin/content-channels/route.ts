import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient, serviceRoleEnvMissingMessage } from '@/lib/supabase/admin'
import { resolveContentAdminUser } from '@/lib/adminContentAccess'

/**
 * 운영자가 기본(전 가족 공통) 콘텐츠 채널을 관리하는 API.
 * 여기서 다루는 행은 모두 `family_link_id is null` — 부모가 추가한 가족 전용 채널은
 * `/api/content/parent-channel` 에서 따로 관리합니다.
 */

async function requireAdmin() {
  const supabase = await createClient()
  const auth = await resolveContentAdminUser(supabase)
  if (!auth.ok) {
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

/** GET /api/admin/content-channels — 기본 채널 전체 */
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const dbRes = requireServiceRole()
  if (!dbRes.ok) return dbRes.response

  const { data, error } = await dbRes.db
    .from('content_channels')
    .select('*')
    .is('family_link_id', null)
    .order('order_index', { ascending: true })

  if (error) {
    console.error('[admin/content-channels:get]', error.message)
    return NextResponse.json({ error: '채널을 불러오지 못했어요' }, { status: 500 })
  }
  return NextResponse.json({ channels: data ?? [] })
}

type ChannelInput = {
  title: string
  playlistUrl: string
  description: string | null
  categoryKey: string
  thumbnailUrl: string | null
  orderIndex: number
}

function parseChannelInput(body: unknown): { ok: true; value: ChannelInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>
  const title = typeof b.title === 'string' ? b.title.trim() : ''
  const playlistUrl = typeof b.playlistUrl === 'string' ? b.playlistUrl.trim() : ''
  const description = typeof b.description === 'string' && b.description.trim() ? b.description.trim() : null
  const categoryKey = typeof b.categoryKey === 'string' ? b.categoryKey.trim() : ''
  const thumbnailUrl = typeof b.thumbnailUrl === 'string' && b.thumbnailUrl.trim() ? b.thumbnailUrl.trim() : null
  const orderIndex = Number.isFinite(Number(b.orderIndex)) ? Math.floor(Number(b.orderIndex)) : 0

  if (!title || title.length > 80) return { ok: false, error: '채널 이름을 확인해 주세요' }
  if (!playlistUrl || !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(playlistUrl)) {
    return { ok: false, error: '유튜브 채널·플레이리스트·영상 링크를 입력해 주세요' }
  }
  if (!categoryKey) return { ok: false, error: '카테고리를 선택해 주세요' }
  if (description && description.length > 300) return { ok: false, error: '소개 문구는 300자 이내로 입력해 주세요' }

  return { ok: true, value: { title, playlistUrl, description, categoryKey, thumbnailUrl, orderIndex } }
}

/** POST /api/admin/content-channels — body: { title, playlistUrl, description?, categoryKey, thumbnailUrl?, orderIndex? } */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }
  const parsed = parseChannelInput(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const dbRes = requireServiceRole()
  if (!dbRes.ok) return dbRes.response

  const { data, error } = await dbRes.db
    .from('content_channels')
    .insert({
      title: parsed.value.title,
      playlist_url: parsed.value.playlistUrl,
      description: parsed.value.description,
      category: parsed.value.categoryKey,
      category_key: parsed.value.categoryKey,
      thumbnail_url: parsed.value.thumbnailUrl,
      order_index: parsed.value.orderIndex,
      family_link_id: null,
    })
    .select('*')
    .single()

  if (error) {
    console.error('[admin/content-channels:post]', error.message)
    return NextResponse.json({ error: '채널을 추가하지 못했어요' }, { status: 500 })
  }
  return NextResponse.json({ channel: data }, { status: 201 })
}

/** PATCH /api/admin/content-channels — body: { id, ...ChannelInput 필드(부분) } */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let body: Record<string, unknown> = {}
  let id = ''
  try {
    const raw = await req.json()
    body = raw ?? {}
    id = typeof body.id === 'string' ? body.id : ''
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }
  if (!id) return NextResponse.json({ error: '채널 정보가 필요해요' }, { status: 400 })

  const parsed = parseChannelInput(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const dbRes = requireServiceRole()
  if (!dbRes.ok) return dbRes.response

  const { data: existing } = await dbRes.db
    .from('content_channels')
    .select('id, family_link_id')
    .eq('id', id)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: '채널을 찾을 수 없어요' }, { status: 404 })
  if (existing.family_link_id !== null) {
    return NextResponse.json({ error: '가족 전용 채널은 이 화면에서 수정할 수 없어요' }, { status: 403 })
  }

  const { data, error } = await dbRes.db
    .from('content_channels')
    .update({
      title: parsed.value.title,
      playlist_url: parsed.value.playlistUrl,
      description: parsed.value.description,
      category: parsed.value.categoryKey,
      category_key: parsed.value.categoryKey,
      thumbnail_url: parsed.value.thumbnailUrl,
      order_index: parsed.value.orderIndex,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('[admin/content-channels:patch]', error.message)
    return NextResponse.json({ error: '채널을 저장하지 못했어요' }, { status: 500 })
  }
  return NextResponse.json({ channel: data })
}

/** DELETE /api/admin/content-channels — body: { id } */
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
  if (!id) return NextResponse.json({ error: '채널 정보가 필요해요' }, { status: 400 })

  const dbRes = requireServiceRole()
  if (!dbRes.ok) return dbRes.response

  const { data: existing } = await dbRes.db
    .from('content_channels')
    .select('id, family_link_id')
    .eq('id', id)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: '채널을 찾을 수 없어요' }, { status: 404 })
  if (existing.family_link_id !== null) {
    return NextResponse.json({ error: '가족 전용 채널은 이 화면에서 삭제할 수 없어요' }, { status: 403 })
  }

  const { error } = await dbRes.db.from('content_channels').delete().eq('id', id)
  if (error) {
    console.error('[admin/content-channels:delete]', error.message)
    return NextResponse.json({ error: '채널을 삭제하지 못했어요' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id })
}
