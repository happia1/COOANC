import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'

/**
 * POST /api/content/child-hidden-channel
 * 부모가 자녀 콘텐츠존에서 채널(기본·가족 전용 공통)을 숨기거나 다시 보이게 합니다.
 * body: { childId, channelId, hidden }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 설정할 수 있어요' }, { status: 403 })
  }

  let childId: string
  let channelId: string
  let hidden: boolean
  try {
    const body = await req.json()
    childId = typeof body.childId === 'string' ? body.childId : ''
    channelId = typeof body.channelId === 'string' ? body.channelId : ''
    hidden = Boolean(body.hidden)
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!childId || !channelId) {
    return NextResponse.json({ error: '자녀와 채널 정보가 필요해요' }, { status: 400 })
  }

  const { data: link } = await supabase
    .from('family_links')
    .select('id')
    .eq('parent_id', user.id)
    .eq('child_id', childId)
    .maybeSingle()
  if (!link) {
    return NextResponse.json({ error: '연결된 자녀만 설정할 수 있어요' }, { status: 403 })
  }

  const db = createServiceRoleClient() ?? supabase

  if (hidden) {
    const { error } = await db.from('content_channel_hidden').insert({ child_id: childId, channel_id: channelId })
    if (error && error.code !== '23505') {
      console.error('[child-hidden-channel] insert', error.code, error.message)
      return NextResponse.json({ error: '저장하지 못했어요' }, { status: 500 })
    }
  } else {
    const { error } = await db
      .from('content_channel_hidden')
      .delete()
      .eq('child_id', childId)
      .eq('channel_id', channelId)
    if (error) {
      console.error('[child-hidden-channel] delete', error.code, error.message)
      return NextResponse.json({ error: '저장하지 못했어요' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
