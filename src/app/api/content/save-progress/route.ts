import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'

/**
 * POST /api/content/save-progress
 * body: { sessionId, childId?, remainingPlaySeconds }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  let sessionId: string
  let bodyChildId: unknown
  let remainingPlaySeconds: unknown
  try {
    const body = await req.json()
    sessionId = body.sessionId
    bodyChildId = body.childId
    remainingPlaySeconds = body.remainingPlaySeconds
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!sessionId || !Number.isFinite(remainingPlaySeconds)) {
    return NextResponse.json({ error: '필수 항목이 누락됐어요' }, { status: 400 })
  }

  const resolved = await resolveApiActorChildId(supabase, user, bodyChildId)
  if (resolved.ok === false) return resolved.response

  const { data, error } = await supabase.rpc('save_content_session_progress', {
    p_session_id: sessionId,
    p_child_id: resolved.childId,
    p_remaining_play_seconds: Math.max(0, Math.floor(Number(remainingPlaySeconds))),
  })

  if (error) {
    const msg = error.message ?? ''
    if (/save_content_session_progress|remaining_play_seconds/i.test(msg)) {
      console.warn('[content/save-progress] migration 106 may be missing')
      return NextResponse.json({ ok: true, degraded: true })
    }
    return NextResponse.json({ error: '저장에 실패했어요' }, { status: 500 })
  }

  return NextResponse.json({ ok: Boolean(data) })
}
