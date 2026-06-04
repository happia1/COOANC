/** 브라우저 — 씨앗 구매 성공 직후 `plant_seed_purchases` 조회 전에도 선택 완료로 인식 */

const PREFIX = 'cooanc:plant-chosen:'

export function markPlantChosenSeedInSession(childId: string): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(`${PREFIX}${childId}`, '1')
  } catch {
    /* noop */
  }
}

export function hasPlantChosenSeedInSession(childId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(`${PREFIX}${childId}`) === '1'
  } catch {
    return false
  }
}
