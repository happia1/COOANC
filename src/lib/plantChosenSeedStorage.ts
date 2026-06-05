/** 브라우저 — 씨앗 구매 성공 직후·재로그인 직후 `plant_seed_purchases` 조회 전에도 선택 완료로 인식 */

const SESSION_PREFIX = 'cooanc:plant-chosen:'
const LOCAL_PREFIX = 'cooanc:plant-chosen-persist:'

function storageKey(prefix: string, childId: string): string {
  return `${prefix}${childId}`
}

export function markPlantChosenSeedInSession(childId: string): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(storageKey(SESSION_PREFIX, childId), '1')
    localStorage.setItem(storageKey(LOCAL_PREFIX, childId), '1')
  } catch {
    /* noop */
  }
}

export function hasPlantChosenSeedInSession(childId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const key = storageKey(SESSION_PREFIX, childId)
    const persistKey = storageKey(LOCAL_PREFIX, childId)
    return sessionStorage.getItem(key) === '1' || localStorage.getItem(persistKey) === '1'
  } catch {
    return false
  }
}
