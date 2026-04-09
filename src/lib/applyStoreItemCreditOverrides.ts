import type { StoreItem } from '@/types/database'

/** 마켓 가격 표시: 0이면 「무료」, 아니면 천 단위 쉼표 */
export function formatMarketCreditLabel(price: number): string {
  const n = Math.floor(price)
  if (n <= 0) return '무료'
  return n.toLocaleString('ko-KR')
}

/**
 * 자녀별 크레딧 덮어쓰기 맵을 `store_items` 목록에 합칩니다.
 * - 덮어쓰기가 없으면 원본 행을 그대로 둡니다(참조 동일).
 * - 있으면 `credit_price` 만 바꾼 얕은 복사를 만듭니다.
 */
export function applyStoreItemCreditOverrides(
  items: StoreItem[],
  overridesByItemId: Record<string, number>,
): StoreItem[] {
  return items.map((it) => {
    const next = overridesByItemId[it.id]
    if (next === undefined) return it
    return { ...it, credit_price: next }
  })
}
