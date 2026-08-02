import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'

/**
 * 부모가 연결된 자녀의 콘텐츠존에 가족 전용 유튜브 채널을 추가/삭제하는 API.
 * 운영자가 기획한 기본 채널(family_link_id null)은 이 API로 건드릴 수 없습니다.
 */

async function resolveParentAuth(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, response: NextResponse.json({ error: '인증이 필요해요' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'parent') {
    return { ok: false as const, response: NextResponse.json({ error: '부모 계정만 사용할 수 있어요' }, { status: 403 }) }
  }
  return { ok: true as const, userId: user.id }
}

async function resolveFamilyLinkIdForChild(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parentId: string,
  childId: string,
) {
  const { data: link, error } = await supabase
    .from('family_links')
    .select('id')
    .eq('parent_id', parentId)
    .eq('child_id', childId)
    .maybeSingle()
  if (error || !link) return null
  return link.id
}

/**
 * POST /api/content/parent-channel
 * body: { childId, title, playlistUrl, description?, categoryKey }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const auth = await resolveParentAuth(supabase)
  if (!auth.ok) return auth.response

  let childId = ''
  let title = ''
  let playlistUrl = ''
  let description: string | null = null
  let categoryKey = ''
  try {
    const body = await req.json()
    childId = typeof body.childId === 'string' ? body.childId.trim() : ''
    title = typeof body.title === 'string' ? body.title.trim() : ''
    playlistUrl = typeof body.playlistUrl === 'string' ? body.playlistUrl.trim() : ''
    description = typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null
    categoryKey = typeof body.categoryKey === 'string' ? body.categoryKey.trim() : ''
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!childId) return NextResponse.json({ error: '자녀 정보가 필요해요' }, { status: 400 })
  if (!title || title.length > 80) return NextResponse.json({ error: '채널 이름을 확인해 주세요' }, { status: 400 })
  if (!playlistUrl || !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(playlistUrl)) {
    return NextResponse.json({ error: '유튜브 채널·플레이리스트·영상 링크를 입력해 주세요' }, { status: 400 })
  }
  if (!categoryKey) return NextResponse.json({ error: '카테고리를 선택해 주세요' }, { status: 400 })
  if (description && description.length > 300) {
    return NextResponse.json({ error: '소개 문구는 300자 이내로 입력해 주세요' }, { status: 400 })
  }

  const linkId = await resolveFamilyLinkIdForChild(supabase, auth.userId, childId)
  if (!linkId) {
    return NextResponse.json({ error: '연결된 자녀에게만 채널을 추가할 수 있어요' }, { status: 403 })
  }

  const { data: category } = await supabase
    .from('content_categories')
    .select('key')
    .eq('key', categoryKey)
    .maybeSingle()
  if (!category) return NextResponse.json({ error: '카테고리를 확인해 주세요' }, { status: 400 })

  // 가족 전용 상품 추가와 동일하게, RLS 누락으로 저장이 막히지 않도록 service_role 을 우선 씁니다.
  const db = createServiceRoleClient() ?? supabase

  const { data: inserted, error: insErr } = await db
    .from('content_channels')
    .insert({
      family_link_id: linkId,
      title,
      playlist_url: playlistUrl,
      description,
      category: categoryKey,
      category_key: categoryKey,
      order_index: 0,
    })
    .select('*')
    .single()

  if (insErr || !inserted) {
    console.error('[parent-channel:post]', insErr?.message)
    return NextResponse.json({ error: '채널을 추가하지 못했어요' }, { status: 500 })
  }

  return NextResponse.json({ channel: inserted }, { status: 201 })
}

/**
 * DELETE /api/content/parent-channel
 * body: { childId, channelId } — 가족 전용 채널만 삭제 가능
 */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const auth = await resolveParentAuth(supabase)
  if (!auth.ok) return auth.response

  let childId = ''
  let channelId = ''
  try {
    const body = await req.json()
    childId = typeof body.childId === 'string' ? body.childId.trim() : ''
    channelId = typeof body.channelId === 'string' ? body.channelId.trim() : ''
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!childId || !channelId) {
    return NextResponse.json({ error: '자녀·채널 정보가 필요해요' }, { status: 400 })
  }

  const linkId = await resolveFamilyLinkIdForChild(supabase, auth.userId, childId)
  if (!linkId) {
    return NextResponse.json({ error: '연결된 자녀만 삭제할 수 있어요' }, { status: 403 })
  }

  const { data: channel, error: chErr } = await supabase
    .from('content_channels')
    .select('id, family_link_id')
    .eq('id', channelId)
    .maybeSingle()
  if (chErr || !channel) return NextResponse.json({ error: '채널을 찾을 수 없어요' }, { status: 404 })
  if (channel.family_link_id !== linkId) {
    return NextResponse.json({ error: '가족 전용 채널만 삭제할 수 있어요' }, { status: 403 })
  }

  const db = createServiceRoleClient() ?? supabase
  const { error: delErr } = await db.from('content_channels').delete().eq('id', channelId)
  if (delErr) {
    console.error('[parent-channel:delete]', delErr.message)
    return NextResponse.json({ error: '채널을 삭제하지 못했어요' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, channelId })
}
