/**
 * 저금통 이자 — **DB(child_stats) 기준**입니다.
 *
 * 비개발자 설명:
 * - 저금통에 10크레딧 이상을 두면 **3일마다** 이자가 붙습니다.
 * - 이자율은 저금액이 많을수록 올라갑니다(10개↑ 10% / 50개↑ 15% / 100개↑ 20% / 200개↑ 25%).
 *   소수점은 버려서 항상 정수 크레딧으로만 지급됩니다.
 * - 10크레딧 아래로 내려가면 기간이 처음부터 다시 시작됩니다(조금 빼는 건 괜찮습니다).
 * - 이자는 자동으로 들어오지 않고 **「받을 보너스」에 쌓입니다.** 저금통 위에 반짝이는
 *   크레딧 코인이 개수만큼 뜨고, 자녀가 1개씩 눌러서 크레딧으로 받아 갑니다.
 * - 계산·지급은 모두 서버가 하므로 폰·태블릿·노트북이 항상 같은 값을 봅니다.
 *
 * 숫자를 바꾸려면 `supabase/migrations/128_piggy_bonus_tiers_and_claim.sql` 의
 * `piggy_bonus_rate_for` 함수·`c_hold_days` 상수와 아래 값을 같이 맞춰 주세요.
 */

/** 이자가 붙기 시작하는 최소 저금액 */
export const PIGGY_BONUS_MIN_BALANCE = 10

/** 이자 지급 주기(일) */
export const PIGGY_BONUS_HOLD_DAYS = 3

/**
 * 저금액 구간별 이자율 — DB `piggy_bonus_rate_for` 와 같은 표입니다.
 * 큰 금액부터 검사하므로 순서를 유지해 주세요.
 */
export const PIGGY_BONUS_TIERS: ReadonlyArray<{ min: number; rate: number }> = [
  { min: 200, rate: 0.25 },
  { min: 100, rate: 0.2 },
  { min: 50, rate: 0.15 },
  { min: 10, rate: 0.1 },
]

/** 지금 저금액에 적용되는 이자율(기준 미달이면 0) */
export function piggyBonusRateFor(piggyCredits: number): number {
  return PIGGY_BONUS_TIERS.find((t) => piggyCredits >= t.min)?.rate ?? 0
}

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

/** 지금 잔액이면 이자를 얼마 받는지(서버 계산식과 동일: 구간 요율, 소수점 버림, 최소 1) */
export function piggyBonusAmountFor(piggyCredits: number): number {
  const rate = piggyBonusRateFor(piggyCredits)
  if (rate <= 0) return 0
  return Math.max(1, Math.floor(piggyCredits * rate))
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
  /** 이번에 새로 붙은 이자 */
  paid: number
  /** 아직 받아 가지 않고 쌓여 있는 이자(= 저금통 위에 뜰 코인 개수) */
  pending: number
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
      pending?: number
      periods?: number
      credits_piggy?: number
      next_at?: string | null
    }
    return {
      paid: Number(j.paid ?? 0),
      pending: Number(j.pending ?? 0),
      periods: Number(j.periods ?? 0),
      creditsPiggy: Number(j.credits_piggy ?? 0),
      nextAtIso: j.next_at ?? null,
    }
  } catch {
    return null
  }
}

/** 보너스 코인 1개 받기 결과 */
export interface PiggyBonusClaimResult {
  claimed: number
  pending: number
  credits: number
}

/**
 * 저금통 위 반짝이는 코인을 눌러 보너스를 1개 받아 갑니다.
 * 남은 개수보다 많이 받을 수 없도록 서버가 행 잠금으로 확인합니다.
 */
export async function claimPiggyBonus(
  childId?: string | null,
  count = 1,
): Promise<PiggyBonusClaimResult | null> {
  if (typeof window === 'undefined') return null
  try {
    const res = await fetch('/api/child/piggy-bonus/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(childId ? { childId } : {}), count }),
    })
    if (!res.ok) return null
    const j = (await res.json()) as { claimed?: number; pending?: number; credits?: number }
    return {
      claimed: Number(j.claimed ?? 0),
      pending: Number(j.pending ?? 0),
      credits: Number(j.credits ?? 0),
    }
  } catch {
    return null
  }
}
