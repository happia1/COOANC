import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'

/**
 * POST /api/content/end-session
 * body: { sessionId, childId? }
 * - content_sessions.is_active = false
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  let sessionId: string
  let bodyChildId: unknown
  try {
    const body = await req.json()
    sessionId = body.sessionId ?? ''
    bodyChildId = body.childId
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!sessionId) {
    return NextResponse.json({ error: '세션 정보가 필요해요' }, { status: 400 })
  }

  const resolved = await resolveApiActorChildId(supabase, user, bodyChildId)
  if (resolved.ok === false) return resolved.response
  const childId = resolved.childId

  const { data, error } = await supabase.rpc('end_content_session', {
    p_session_id: sessionId,
    p_child_id: childId,
  })

  if (error) {
    return NextResponse.json({ error: '세션 종료에 실패했어요' }, { status: 500 })
  }

  return NextResponse.json({ ok: Boolean(data) })
}
