import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceRoleClient } from '@/lib/supabase/admin'

/** RPC 지급 시 RLS·권한 이슈를 피하기 위해 service role 우선 사용 */
function grantSupabaseClient(fallback: SupabaseClient): SupabaseClient {
  return createServiceRoleClient() ?? fallback
}

/** DB `store_items.name` · 구매 스냅샷과 일치 */
export const VIDEO_VIEWING_PASS_ITEM_NAME = '영상 시청권 30분'

export const MINIGAME_PLAY_PASS_ITEM_NAME = '미니게임 이용권'

/** @deprecated `VIDEO_VIEWING_PASS_ITEM_NAME` 사용 */
export const CONTENT_TICKET_ITEM_NAME = VIDEO_VIEWING_PASS_ITEM_NAME

const LEGACY_VIDEO_PASS_NAMES = ['콘텐츠 30분 이용권', '콘텐츠 이용권 30분'] as const

const QUANTITY_PURCHASABLE_NAMES = new Set<string>([
  VIDEO_VIEWING_PASS_ITEM_NAME,
  MINIGAME_PLAY_PASS_ITEM_NAME,
  ...LEGACY_VIDEO_PASS_NAMES,
])

/** 영상·미니게임 등 수량 구매 가능한 콘텐츠 마켓 상품 */
export function isQuantityPurchasableMarketItem(
  name: string | null | undefined,
  category?: string | null,
): boolean {
  if (category === 'content') return true
  if (!name) return false
  return QUANTITY_PURCHASABLE_NAMES.has(name.trim())
}

/** @deprecated `isQuantityPurchasableMarketItem` 사용 */
export function isContentTicketItemName(name: string | null | undefined): boolean {
  return isQuantityPurchasableMarketItem(name)
}

function isVideoViewingPassName(name: string): boolean {
  const trimmed = name.trim()
  return (
    trimmed === VIDEO_VIEWING_PASS_ITEM_NAME ||
    LEGACY_VIDEO_PASS_NAMES.includes(trimmed as (typeof LEGACY_VIDEO_PASS_NAMES)[number])
  )
}

function isMinigamePassName(name: string): boolean {
  return name.trim() === MINIGAME_PLAY_PASS_ITEM_NAME
}

/** 마켓 구매 완료(부모 승인·배송) 시 콘텐츠·미니게임 이용권 지급 */
export async function grantMarketContentRewardsIfApplicable(
  supabase: SupabaseClient,
  childId: string,
  itemName: string | null | undefined,
  quantity = 1,
): Promise<number | null> {
  if (!itemName) return null

  const amount = Math.max(1, Math.floor(quantity))
  const grantClient = grantSupabaseClient(supabase)

  if (isVideoViewingPassName(itemName)) {
    const { data, error } = await grantClient.rpc('grant_content_ticket', {
      p_child_id: childId,
      p_amount: amount,
    })
    if (error) {
      console.error('[contentTickets] video grant failed:', error.message)
      return null
    }
    return typeof data === 'number' ? data : null
  }

  if (isMinigamePassName(itemName)) {
    const { data, error } = await grantClient.rpc('grant_minigame_ticket', {
      p_child_id: childId,
      p_amount: amount,
    })
    if (error) {
      console.error('[contentTickets] minigame grant failed:', error.message)
      return null
    }
    return typeof data === 'number' ? data : null
  }

  return null
}

export type PurchaseRequestRewardGrantRow = {
  id: string
  child_id: string
  item_name: string
  quantity: number | null
  rewards_granted_at?: string | null
}

/**
 * 구매 요청 1건당 이용권을 최대 1번만 지급합니다.
 * 비개발자: 부모 승인과 「받았어요」가 둘 다 실행돼도 같은 주문은 한 번만 적립됩니다.
 */
export async function grantMarketContentRewardsForPurchaseOnce(
  supabase: SupabaseClient,
  row: PurchaseRequestRewardGrantRow,
): Promise<number | null> {
  if (!isQuantityPurchasableMarketItem(row.item_name)) return null
  if (row.rewards_granted_at) return null

  const grantClient = grantSupabaseClient(supabase)
  const now = new Date().toISOString()

  const { data: claimed, error: claimErr } = await grantClient
    .from('purchase_requests')
    .update({ rewards_granted_at: now })
    .eq('id', row.id)
    .is('rewards_granted_at', null)
    .select('id, child_id, item_name, quantity')
    .maybeSingle()

  if (claimErr) {
    if (/rewards_granted_at/i.test(claimErr.message)) {
      console.warn('[contentTickets] rewards_granted_at column missing — run migration 105')
      return grantMarketContentRewardsIfApplicable(
        supabase,
        row.child_id,
        row.item_name,
        row.quantity ?? 1,
      )
    }
    console.error('[contentTickets] claim grant slot failed:', claimErr.message)
    return null
  }

  if (!claimed) return null

  const qty = typeof claimed.quantity === 'number' ? claimed.quantity : 1
  const result = await grantMarketContentRewardsIfApplicable(
    supabase,
    claimed.child_id as string,
    claimed.item_name as string,
    qty,
  )

  if (result == null) {
    await grantClient
      .from('purchase_requests')
      .update({ rewards_granted_at: null })
      .eq('id', row.id)
  }

  return result
}

/** @deprecated `grantMarketContentRewardsForPurchaseOnce` 사용 */
export async function grantContentTicketIfApplicable(
  supabase: SupabaseClient,
  childId: string,
  itemName: string | null | undefined,
  quantity = 1,
): Promise<number | null> {
  return grantMarketContentRewardsIfApplicable(supabase, childId, itemName, quantity)
}
