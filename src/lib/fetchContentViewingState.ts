import type { SupabaseClient } from '@supabase/supabase-js'

export type ContentViewingState = {
  /** 영상 시청·인형뽑기 미니게임 공용 「보물상자 티켓」 수량 */
  chestTicketQuantity: number
  watchSecondsPool: number
  activeSession: {
    id: string
    remainingPlaySeconds: number
    playlistUrl: string | null
  } | null
}

const ZERO: ContentViewingState = {
  chestTicketQuantity: 0,
  watchSecondsPool: 0,
  activeSession: null,
}

function readInt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

/** 남은 시청 가능 초 = 풀 + 활성 세션 */
export function totalAvailableWatchSeconds(state: ContentViewingState): number {
  return state.watchSecondsPool + (state.activeSession?.remainingPlaySeconds ?? 0)
}

export async function fetchContentViewingState(
  supabase: SupabaseClient,
  childId: string,
): Promise<ContentViewingState> {
  try {
    const [ticketRes, sessionRes] = await Promise.all([
      supabase
        .from('content_tickets')
        .select('quantity, watch_seconds_remaining')
        .eq('child_id', childId)
        .maybeSingle(),
      supabase
        .from('content_sessions')
        .select('id, remaining_play_seconds, duration_minutes, playlist_url, is_active')
        .eq('child_id', childId)
        .eq('is_active', true)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const qty = readInt(ticketRes.data?.quantity)
    const poolFromColumn = ticketRes.data?.watch_seconds_remaining
    const watchSecondsPool =
      poolFromColumn != null ? readInt(poolFromColumn) : qty * 1800

    const sessionRow = sessionRes.data as {
      id?: string
      remaining_play_seconds?: number | null
      duration_minutes?: number
      playlist_url?: string | null
    } | null

    const sessionRemaining =
      sessionRow?.remaining_play_seconds != null
        ? readInt(sessionRow.remaining_play_seconds)
        : sessionRow?.duration_minutes != null
          ? sessionRow.duration_minutes * 60
          : 0

    const activeSession =
      sessionRow?.id && sessionRemaining > 0
        ? {
            id: sessionRow.id,
            remainingPlaySeconds: sessionRemaining,
            playlistUrl: sessionRow.playlist_url ?? null,
          }
        : null

    return {
      chestTicketQuantity: qty,
      watchSecondsPool,
      activeSession,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[contentViewing] fetch failed', msg)
    return ZERO
  }
}
