import type { PraiseStickerGrant } from '@/types/database'

/**
 * 서버(RSC)에서 다시 내려준 grants 와 클라이언트 이전 상태를 합칩니다.
 * 도착 팝업을 닫은 뒤에도 서버 데이터가 잠깐 옛날이면 popup_dismissed_at 이 null 로 와서
 * 팝업이 반복될 수 있어, 이미 클라에서 확인한 시각은 유지합니다.
 */
export function mergePraiseStickerGrantsFromServer(
  server: PraiseStickerGrant[],
  prev: PraiseStickerGrant[],
): PraiseStickerGrant[] {
  const prevById = new Map(prev.map((g) => [g.id, g]))
  const serverIds = new Set(server.map((g) => g.id))
  /** RSC 목록이 잠깐 늦으면 realtime 으로만 들어온 grant 가 사라지지 않게 유지 */
  const pendingLocalOnly = prev.filter((g) => !serverIds.has(g.id))
  const merged = server.map((g) => {
    const p = prevById.get(g.id)
    if (!p) return g
    const pDismiss = p.popup_dismissed_at
    const sDismiss = g.popup_dismissed_at
    if (pDismiss == null) return g
    if (sDismiss == null || pDismiss >= sDismiss) {
      return { ...g, popup_dismissed_at: pDismiss }
    }
    return g
  })
  return [...pendingLocalOnly, ...merged]
}
