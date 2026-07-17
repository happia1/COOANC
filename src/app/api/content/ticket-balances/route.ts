import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import {
  fetchContentViewingState,
  totalAvailableWatchSeconds,
} from '@/lib/fetchContentViewingState'

/**
 * GET /api/content/ticket-balances?childId=
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  const childIdParam = req.nextUrl.searchParams.get('childId')
  const resolved = await resolveApiActorChildId(supabase, user, childIdParam)
  if (resolved.ok === false) return resolved.response

  const state = await fetchContentViewingState(supabase, resolved.childId)
  return NextResponse.json({
    chestTicketQuantity: state.chestTicketQuantity,
    watchSecondsPool: state.watchSecondsPool,
    totalWatchSeconds: totalAvailableWatchSeconds(state),
    activeSession: state.activeSession,
  })
}
