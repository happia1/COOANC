import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'

/**
 * POST /api/content/child-channel-order
 * body: { childId, orderedChannelIds: string[] }
 *
 * 비개발자 설명:
 * - 부모가 「콘텐츠 관리」에서 카드를 길게 눌러 옮긴 순서를 자녀 단위로 저장합니다.
 * - 자녀별로 저장하므로, 기본 채널의 순서를 바꿔도 다른 가족에는 영향이 없습니다.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 저장할 수 있어요' }, { status: 403 })
  }

  let childId = ''
  let orderedChannelIds: string[] = []
  try {
    const body = await req.json()
    childId = typeof body.childId === 'string' ? body.childId.trim() : ''
    orderedChannelIds = Array.isArray(body.orderedChannelIds)
      ? body.orderedChannelIds
          .filter((v: unknown): v is string => typeof v === 'string' && v.trim() !== '')
          .map((v: string) => v.trim())
      : []
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!childId) return NextResponse.json({ error: '자녀 정보가 필요해요' }, { status: 400 })
  if (orderedChannelIds.length === 0) {
    return NextResponse.json({ error: '순서 정보가 비어 있어요' }, { status: 400 })
  }

  const uniqueIds = Array.from(new Set(orderedChannelIds))

  const { data: link, error: linkErr } = await supabase
    .from('family_links')
    .select('id')
    .eq('parent_id', user.id)
    .eq('child_id', childId)
    .maybeSingle()
  if (linkErr || !link) {
    return NextResponse.json({ error: '연결된 자녀만 설정할 수 있어요' }, { status: 403 })
  }

  /** 기본 채널(family_link_id null) + 우리 가족 채널만 저장 대상으로 인정 */
  const { data: channels, error: chErr } = await supabase
    .from('content_channels')
    .select('id, family_link_id')
    .in('id', uniqueIds)
  if (chErr || !channels) {
    return NextResponse.json({ error: '채널을 확인하지 못했어요' }, { status: 500 })
  }

  const validIdSet = new Set(
    channels
      .filter((ch) => ch.family_link_id == null || ch.family_link_id === link.id)
      .map((ch) => ch.id),
  )
  const filteredIds = uniqueIds.filter((id) => validIdSet.has(id))
  if (filteredIds.length === 0) {
    return NextResponse.json({ error: '저장 가능한 채널이 없어요' }, { status: 400 })
  }

  const rows = filteredIds.map((channelId, idx) => ({
    child_id: childId,
    channel_id: channelId,
    order_rank: idx,
    updated_at: new Date().toISOString(),
  }))

  const db = createServiceRoleClient() ?? supabase
  const { error: upErr } = await db
    .from('content_channel_orders')
    .upsert(rows, { onConflict: 'child_id,channel_id' })

  if (upErr) {
    console.error('[child-channel-order] upsert', upErr.message)
    /** 마이그레이션 133 미적용 DB 에서 원인을 바로 알 수 있게 안내합니다 */
    const missingTable = /content_channel_orders/i.test(upErr.message) && /does not exist|Could not find/i.test(upErr.message)
    return NextResponse.json(
      {
        error: missingTable
          ? '순서 저장용 테이블이 아직 없어요. supabase/migrations/133_content_channel_orders.sql 을 적용해 주세요.'
          : '순서를 저장하지 못했어요',
      },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, savedCount: rows.length })
}
