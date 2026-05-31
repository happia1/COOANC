import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchContentViewingState } from '@/lib/fetchContentViewingState'

export type ContentTicketBalances = {
  videoQuantity: number
  minigameQuantity: number
}

/**
 * 자녀별 영상·미니게임 이용권 보유 수를 조회합니다.
 */
export async function fetchContentTicketBalances(
  supabase: SupabaseClient,
  childId: string,
): Promise<ContentTicketBalances> {
  const state = await fetchContentViewingState(supabase, childId)
  return {
    videoQuantity: state.videoTicketQuantity,
    minigameQuantity: state.minigameTicketQuantity,
  }
}
