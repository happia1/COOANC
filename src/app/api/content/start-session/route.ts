import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'

/**
 * POST /api/content/start-session
 * body: { childId?, playlistUrl? }
 * - 남은 시청 시간 풀에서 세션 시작 또는 재개
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  let bodyChildId: unknown
  let playlistUrl: string | null = null
  try {
    const body = await req.json()
    bodyChildId = body.childId
    playlistUrl = typeof body.playlistUrl === 'string' ? body.playlistUrl : null
  } catch {
    bodyChildId = undefined
  }

  const resolved = await resolveApiActorChildId(supabase, user, bodyChildId)
  if (resolved.ok === false) return resolved.response
  const childId = resolved.childId

  const { data, error } = await supabase.rpc('begin_content_viewing', {
    p_child_id: childId,
    p_playlist_url: playlistUrl,
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('no tickets')) {
      return NextResponse.json({ error: '시청 시간이 없어요. 마켓에서 이용권을 구매해 주세요!' }, { status: 400 })
    }
    if (msg.includes('forbidden')) {
      return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })
    }
    if (/begin_content_viewing|watch_seconds_remaining/i.test(msg)) {
      return NextResponse.json(
        { error: '시청 기능 준비 중이에요. 관리자에게 마이그레이션 106 적용을 요청해 주세요.' },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: '시청을 시작할 수 없어요' }, { status: 500 })
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.session_id) {
    return NextResponse.json({ error: '시청을 시작할 수 없어요' }, { status: 500 })
  }

  return NextResponse.json({
    sessionId: row.session_id as string,
    remainingPlaySeconds: row.remaining_play_seconds as number,
    remainingQuantity: row.ticket_quantity as number,
    watchSecondsPool: row.watch_seconds_pool as number,
    resumed: Boolean(row.resumed),
  })
}
