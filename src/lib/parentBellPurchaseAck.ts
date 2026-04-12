/**
 * 부모 상단 알림·공지 시트에서 「구매 승인 대기」를 확인했을 때의 상태를 브라우저에만 둡니다.
 * - 요청 UUID 를 저장해 두었다가, 아직 대기 중인 건은 시트·뱃지에서 숨깁니다.
 * - 승인·반려 등으로 DB 에서 빠진 id 는 저장소에서도 정리해 두어 용량이 불필요하게 커지지 않게 합니다.
 */

const STORAGE_KEY = 'cooanc_parent_bell_ack_purchase_request_ids'

/** localStorage 에서 확인 완료한 purchase_requests.id 목록을 읽습니다 */
export function readAcknowledgedPurchaseRequestIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const arr = raw ? JSON.parse(raw) : []
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x): x is string => typeof x === 'string' && x.length > 0))
  } catch {
    return new Set()
  }
}

/** 확인한 id 들을 저장합니다(기존 항목과 합칩니다) */
export function writeAcknowledgedPurchaseRequestIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    /* 저장 실패 시 UI 만 맞고 다음에 다시 시도 */
  }
}

/**
 * DB 에서 여전히 대기(pending·parent_buying)인 id 만 남깁니다.
 * - 처리되어 목록에서 사라진 id 는 저장소에서도 지웁니다.
 */
export function pruneAcknowledgedToCurrentPending(
  acknowledged: Set<string>,
  currentPendingIds: readonly string[],
): Set<string> {
  const cur = new Set(currentPendingIds)
  return new Set([...acknowledged].filter((id) => cur.has(id)))
}
