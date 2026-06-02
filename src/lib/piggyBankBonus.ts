/**
 * 저금통 「기간 유지 보너스」 — 추후 서버 지급 API 와 연동할 예정입니다.
 *
 * 비개발자 설명:
 * - 아이가 저금통에 코인을 넣기 시작한 날부터 며칠이 지나면 보너스 크레딧을 줄 계획입니다.
 * - 지금은 날짜만 기기에 기억하고, 화면에 “며칠 남았는지”만 보여 줍니다.
 */

/** 저금통에 돈을 넣은 뒤 보너스를 받기까지 필요한 일수(기획 기본값) */
export const PIGGY_BONUS_HOLD_DAYS = 7

/** 보너스로 줄 크레딧 수(기획 기본값 — 실제 지급은 추후 API) */
export const PIGGY_BONUS_CREDIT_AMOUNT = 10

/** 자녀별 “저금 시작 시각”을 localStorage 에 저장하는 키 */
export function piggyBonusSinceStorageKey(childId: string): string {
  return `cooanc:piggy-bonus-since:${childId}`
}

export type PiggyBonusProgress = {
  /** 저금 시작 후 경과 일수(0부터) */
  daysHeld: number
  /** 보너스까지 남은 일수 — 이미 받을 수 있으면 0 */
  daysRemaining: number
  /** 보너스 수령 가능 여부(기간 충족) */
  bonusReady: boolean
  /** 저금 시작 시각 ISO 문자열 — 아직 한 번도 저금하지 않았으면 null */
  startedAtIso: string | null
}

function msToWholeDays(ms: number): number {
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)))
}

/**
 * localStorage 에 저장된 저금 시작 시각으로 보너스 진행률을 계산합니다.
 * - `piggyCredits > 0` 인데 시작 시각이 없으면 “지금”을 시작 시각으로 간주합니다(표시용).
 */
export function getPiggyBonusProgress(
  childId: string,
  piggyCredits: number,
  nowMs: number = Date.now(),
): PiggyBonusProgress {
  if (typeof window === 'undefined') {
    return { daysHeld: 0, daysRemaining: PIGGY_BONUS_HOLD_DAYS, bonusReady: false, startedAtIso: null }
  }

  const key = piggyBonusSinceStorageKey(childId)
  let startedAtIso = window.localStorage.getItem(key)

  if (!startedAtIso && piggyCredits > 0) {
    startedAtIso = new Date(nowMs).toISOString()
    window.localStorage.setItem(key, startedAtIso)
  }

  if (!startedAtIso) {
    return {
      daysHeld: 0,
      daysRemaining: PIGGY_BONUS_HOLD_DAYS,
      bonusReady: false,
      startedAtIso: null,
    }
  }

  const startedMs = new Date(startedAtIso).getTime()
  const daysHeld = Number.isFinite(startedMs) ? msToWholeDays(nowMs - startedMs) : 0
  const daysRemaining = Math.max(0, PIGGY_BONUS_HOLD_DAYS - daysHeld)

  return {
    daysHeld,
    daysRemaining,
    bonusReady: daysHeld >= PIGGY_BONUS_HOLD_DAYS && piggyCredits > 0,
    startedAtIso,
  }
}

/** 첫 저금(또는 저금통 잔액 증가) 시 보너스 카운트 시작 시각을 기록합니다. */
export function markPiggyBonusPeriodStarted(childId: string, atMs: number = Date.now()): void {
  if (typeof window === 'undefined') return
  const key = piggyBonusSinceStorageKey(childId)
  if (window.localStorage.getItem(key)) return
  window.localStorage.setItem(key, new Date(atMs).toISOString())
}
