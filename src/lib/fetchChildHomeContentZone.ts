import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContentCategory, ContentChannel, ContentSession } from '@/types/database'

export type ChildHomeContentZoneData = {
  channels: ContentChannel[]
  /** 카테고리별 탐색용 — order_index 순 */
  categories: ContentCategory[]
  /** 영상 시청·인형뽑기 미니게임 공용 「보물상자 티켓」 수량 */
  chestTicketQuantity: number
  activeSession: ContentSession | null
}

export const EMPTY_CHILD_HOME_CONTENT_ZONE: ChildHomeContentZoneData = {
  channels: [],
  categories: [],
  chestTicketQuantity: 0,
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
    const [channelsRes, categoriesRes, ticketRes, sessionRes, familyLinksRes, hiddenRes] = await Promise.all([
      supabase.from('content_channels').select('*').order('order_index', { ascending: true }),
      supabase.from('content_categories').select('*').order('order_index', { ascending: true }),
      supabase
        .from('content_tickets')
        .select('quantity, watch_seconds_remaining')
        .eq('child_id', childId)
        .maybeSingle(),
      supabase
        .from('content_sessions')
        .select('*')
        .eq('child_id', childId)
        .eq('is_active', true)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('family_links').select('id').eq('child_id', childId),
      supabase.from('content_channel_hidden').select('channel_id').eq('child_id', childId),
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
    if (categoriesRes.error) {
      console.warn('[child/home] content_categories', categoriesRes.error.message)
    }
    if (sessionRes.error) {
      console.warn('[child/home] content_sessions', sessionRes.error.message)
    }

    /** 이 자녀의 가족 연결 id(보통 1개) — 가족 전용 채널 필터링에 사용 */
    const familyLinkIds = new Set(
      ((familyLinksRes.data ?? []) as { id: string }[]).map((r) => r.id),
    )
    const hiddenChannelIds = new Set(
      ((hiddenRes.data ?? []) as { channel_id: string }[]).map((r) => r.channel_id),
    )

    const allChannels = (channelsRes.data ?? []) as ContentChannel[]
    /** 기본(전 가족 공통) 채널 + 이 가족이 추가한 전용 채널만, 부모가 숨긴 채널은 제외 */
    const channels = allChannels.filter((ch) => {
      if (hiddenChannelIds.has(ch.id)) return false
      if (ch.family_link_id == null) return true
      return familyLinkIds.has(ch.family_link_id)
    })

    const categories = (categoriesRes.data ?? []) as ContentCategory[]

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
      categories,
      chestTicketQuantity: qty,
      activeSession,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[child/home] content zone fetch failed', msg)
    return EMPTY_CHILD_HOME_CONTENT_ZONE
  }
}
