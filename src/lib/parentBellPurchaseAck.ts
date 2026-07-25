/**
 * 부모 상단 알림 시트에서 「구매 승인 대기」를 확인한 상태 — **DB 기준**입니다.
 *
 * 비개발자 설명:
 * - 예전에는 확인 표시를 그 기기(브라우저)에만 저장해서, 노트북에서 알림을 확인해도
 *   폰·태블릿에는 뱃지가 그대로 남아 기기마다 알림 개수가 달랐습니다.
 * - 이제 `parent_purchase_request_acks` 테이블에 저장해 모든 기기가 같은 상태를 봅니다.
 * - 승인·반려로 요청이 사라지면 DB 의 외래키(on delete cascade)가 알아서 정리합니다.
 */

import { createClient } from '@/lib/supabase/client'

/** 이 부모가 확인 완료한 purchase_requests.id 목록을 DB 에서 읽습니다 */
export async function readAcknowledgedPurchaseRequestIds(): Promise<Set<string>> {
  if (typeof window === 'undefined') return new Set()
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return new Set()

    const { data, error } = await supabase
      .from('parent_purchase_request_acks')
      .select('purchase_request_id')
      .eq('parent_id', user.id)
    if (error || !data) return new Set()

    return new Set(
      (data as { purchase_request_id: string }[])
        .map((r) => r.purchase_request_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    )
  } catch {
    return new Set()
  }
}

/**
 * 확인한 id 들을 DB 에 기록합니다(이미 있으면 무시).
 * 다른 기기에서도 곧바로 확인 완료 상태가 됩니다.
 */
export async function writeAcknowledgedPurchaseRequestIds(ids: Set<string>): Promise<void> {
  if (typeof window === 'undefined' || ids.size === 0) return
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const rows = [...ids].map((purchase_request_id) => ({
      parent_id: user.id,
      purchase_request_id,
    }))
    const { error } = await supabase
      .from('parent_purchase_request_acks')
      .upsert(rows, { onConflict: 'parent_id,purchase_request_id', ignoreDuplicates: true })
    if (error) {
      console.warn('[parentBellPurchaseAck] 확인 상태 저장 실패(127 마이그레이션 필요?):', error.message)
    }
  } catch {
    /* 저장 실패 시 이번 화면만 맞고 다음에 다시 시도 */
  }
}

/**
 * DB 에서 여전히 대기(pending·parent_buying)인 id 만 남깁니다.
 * 화면 표시용 계산이며, 저장소 정리는 DB 의 cascade 가 담당합니다.
 */
export function pruneAcknowledgedToCurrentPending(
  acknowledged: Set<string>,
  currentPendingIds: readonly string[],
): Set<string> {
  const cur = new Set(currentPendingIds)
  return new Set([...acknowledged].filter((id) => cur.has(id)))
}
