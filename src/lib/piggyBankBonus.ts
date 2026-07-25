/**
 * 저금통 「기간 유지 보너스」(이자) — **DB(child_stats) 기준**입니다.
 *
 * 비개발자 설명:
 * - 저금통에 10크레딧 이상을 7일 동안 두면, 그 시점 잔액의 10%를 보너스로 넣어 줍니다.
 *   (예: 50크레딧을 7일 유지 → 5크레딧 지급)
 * - 조금 빼는 건 괜찮지만, 10크레딧 아래로 내려가면 기간이 처음부터 다시 시작됩니다.
 * - 계산·지급은 모두 서버(`settle_piggy_bonus`)에서 하므로 폰·태블릿·노트북이 항상 같은 값을 봅니다.
 *   (예전에는 시작일을 기기에만 적어 두어 기기마다 값이 달랐고, 실제 지급도 되지 않았습니다.)
 *
 * 숫자를 바꾸려면 `supabase/migrations/127_piggy_bonus_and_bell_ack.sql` 의
 * 함수 상단 상수(c_min_balance / c_hold_days / c_rate)와 아래 값을 같이 맞춰 주세요.
 */

/** 보너스 기간이 시작되는 최소 저금액 */
export const PIGGY_BONUS_MIN_BALANCE = 10

/** 저금통에 돈을 넣은 뒤 보너스를 받기까지 필요한 일수 */
export const PIGGY_BONUS_HOLD_DAYS = 7

/** 지급 비율 — 잔액의 10% */
export const PIGGY_BONUS_RATE = 0.1

export type PiggyBonusProgress = {
  /** 기간 시작 후 경과 일수(0부터) */
  daysHeld: number
  /** 보너스까지 남은 일수 — 이미 받을 수 있으면 0 */
  daysRemaining: number
  /** 보너스 수령 가능 여부(기간 충족) */
  bonusReady: boolean
  /** 기간 시작 시각 ISO — 최소 저금액 미만이면 null */
  startedAtIso: string | null
  /** 지금 잔액 기준 예상 지급액(표시용) */
  expectedAmount: number
}

function msToWholeDays(ms: number): number {
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)))
}

/** 지금 잔액이면 얼마를 받는지(서버 계산식과 동일: 10%, 소수점 버림, 최소 1) */
export function piggyBonusAmountFor(piggyCredits: number): number {
  if (piggyCredits < PIGGY_BONUS_MIN_BALANCE) return 0
  return Math.max(1, Math.floor(piggyCredits * PIGGY_BONUS_RATE))
}

/**
 * 서버가 준 값으로 보너스 진행률을 계산합니다(표시 전용 — 지급은 서버가 합니다).
 *
 * @param piggyCredits 저금통 잔액(child_stats.credits_piggy)
 * @param sinceIso     child_stats.piggy_bonus_since
 * @param lastPaidIso  child_stats.piggy_bonus_last_paid_at
 */
export function getPiggyBonusProgress(
  piggyCredits: number,
  sinceIso: string | null,
  lastPaidIso: string | null,
  nowMs: number = Date.now(),
): PiggyBonusProgress {
  const expectedAmount = piggyBonusAmountFor(piggyCredits)

  if (piggyCredits < PIGGY_BONUS_MIN_BALANCE || !sinceIso) {
    return {
      daysHeld: 0,
      daysRemaining: PIGGY_BONUS_HOLD_DAYS,
      bonusReady: false,
      startedAtIso: null,
      expectedAmount,
    }
  }

  /** 다음 지급 기준점 = 마지막 지급 시각(없으면 기간 시작) — 서버 로직과 동일 */
  const anchorIso = lastPaidIso ?? sinceIso
  const anchorMs = new Date(anchorIso).getTime()
  const daysHeld = Number.isFinite(anchorMs) ? msToWholeDays(nowMs - anchorMs) : 0

  return {
    daysHeld,
    daysRemaining: Math.max(0, PIGGY_BONUS_HOLD_DAYS - daysHeld),
    bonusReady: daysHeld >= PIGGY_BONUS_HOLD_DAYS,
    startedAtIso: sinceIso,
    expectedAmount,
  }
}

/** 서버 정산 결과 */
export interface PiggyBonusSettleResult {
  paid: number
  periods: number
  creditsPiggy: number
  nextAtIso: string | null
}

/**
 * 저금통 보너스 정산을 서버에 요청합니다(조건이 안 되면 0원 반환 — 호출해도 안전).
 * 자녀 앱 진입·저금 직후에 부르면 됩니다.
 */
export async function settlePiggyBonus(childId?: string | null): Promise<PiggyBonusSettleResult | null> {
  if (typeof window === 'undefined') return null
  try {
    const res = await fetch('/api/child/piggy-bonus/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(childId ? { childId } : {}),
    })
    if (!res.ok) return null
    const j = (await res.json()) as {
      paid?: number
      periods?: number
      credits_piggy?: number
      next_at?: string | null
    }
    return {
      paid: Number(j.paid ?? 0),
      periods: Number(j.periods ?? 0),
      creditsPiggy: Number(j.credits_piggy ?? 0),
      nextAtIso: j.next_at ?? null,
    }
  } catch {
    return null
  }
}
