import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContentChannel, ContentSession } from '@/types/database'

export type ChildHomeContentZoneData = {
  channels: ContentChannel[]
  videoTicketQuantity: number
  minigameTicketQuantity: number
  /** @deprecated `videoTicketQuantity` 사용 */
  ticketQuantity: number
  activeSession: ContentSession | null
}

export const EMPTY_CHILD_HOME_CONTENT_ZONE: ChildHomeContentZoneData = {
  channels: [],
  videoTicketQuantity: 0,
  minigameTicketQuantity: 0,
  ticketQuantity: 0,
  activeSession: null,
}

/** 마이그레이션 096 미적용 등으로 content_* 테이블이 없을 때 */
function isMissingContentZoneTable(message: string | undefined): boolean {
  if (!message) return false
  return /content_(channels|tickets|sessions)/i.test(message) && /does not exist|Could not find/i.test(message)
}

function readInt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

/**
 * 콘텐츠존 SSR 데이터 — 실패해도 자녀 홈 전체가 깨지지 않게 별도 조회합니다.
 * 썸네일은 DB 값만 사용하고, 유튜브 조회는 클라이언트 `ContentChannelThumbnail` 이 담당합니다.
 */
export async function fetchChildHomeContentZoneData(
  supabase: SupabaseClient,
  childId: string,
): Promise<ChildHomeContentZoneData> {
  try {
    const [channelsRes, ticketRes, minigameRes, sessionRes] = await Promise.all([
      supabase.from('content_channels').select('*').order('order_index', { ascending: true }),
      supabase
        .from('content_tickets')
        .select('quantity, watch_seconds_remaining')
        .eq('child_id', childId)
        .maybeSingle(),
      supabase.from('minigame_tickets').select('quantity').eq('child_id', childId).maybeSingle(),
      supabase
        .from('content_sessions')
        .select('*')
        .eq('child_id', childId)
        .eq('is_active', true)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const zoneErr =
      channelsRes.error?.message ?? ticketRes.error?.message ?? sessionRes.error?.message
    if (isMissingContentZoneTable(zoneErr)) {
      console.warn('[child/home] content zone tables missing — run migration 096')
      return EMPTY_CHILD_HOME_CONTENT_ZONE
    }

    if (channelsRes.error) {
      console.warn('[child/home] content_channels', channelsRes.error.message)
    }
    if (sessionRes.error) {
      console.warn('[child/home] content_sessions', sessionRes.error.message)
    }

    const channels = (channelsRes.data ?? []) as ContentChannel[]

    const qty = readInt(ticketRes.data?.quantity)

    const row = sessionRes.data as ContentSession | null
    const sessionRemaining =
      row?.remaining_play_seconds != null
        ? readInt(row.remaining_play_seconds)
        : row?.duration_minutes != null
          ? row.duration_minutes * 60
          : 0

    const activeSession: ContentSession | null =
      row && sessionRemaining > 0
        ? {
            ...row,
            remaining_play_seconds: sessionRemaining,
          }
        : null

    return {
      channels,
      videoTicketQuantity: qty,
      minigameTicketQuantity: readInt(minigameRes.data?.quantity),
      ticketQuantity: qty,
      activeSession,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[child/home] content zone fetch failed', msg)
    return EMPTY_CHILD_HOME_CONTENT_ZONE
  }
}
