/**
 * 연령·레벨에 따른 자녀 앱 기능 해금
 *
 * 비개발자 설명:
 * - 레벨 5부터 홈 화면 **저금통**을 쓸 수 있습니다.
 * - 크레딧은 레벨 블록 숫자(가용)와 저금통(저축) 두 가지만 구분합니다.
 */

/** 홈 저금통 해금 — 레벨 5 이상 */
export const PIGGY_BANK_UNLOCK_MIN_LEVEL = 5

/** @deprecated 예전 3분할(돈바구니·지갑·저금통) 호환용 — 새 코드에서는 쓰지 않습니다 */
export const MULTI_BUCKET_MIN_LEVEL = PIGGY_BANK_UNLOCK_MIN_LEVEL

export function isPiggyBankUnlocked(level: number): boolean {
  return level >= PIGGY_BANK_UNLOCK_MIN_LEVEL
}

/**
 * @deprecated 예전 단일/멀티 버킷 분기 — 항상 false(멀티 분할 UI 제거됨)
 */
export function usesSingleBucket(level: number, ageYears?: number | null): boolean {
  void level
  void ageYears
  return false
}

/** `birth_date` → 만 나이(세) 러프 추정용 1년 길이(ms) */
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000

/**
 * `profiles` 행(자녀 본인 id)에서 만 나이(세)를 뽑습니다.
 */
export function ageYearsFromProfileRow(
  p: { age: number | null; birth_date: string | null } | null | undefined,
): number | null {
  if (!p) return null
  if (typeof p.age === 'number' && Number.isFinite(p.age) && p.age >= 0) {
    return Math.min(120, Math.floor(p.age))
  }
  if (p.birth_date) {
    const t = new Date(`${p.birth_date}T12:00:00`).getTime()
    if (Number.isFinite(t)) {
      return Math.max(0, Math.floor((Date.now() - t) / MS_PER_YEAR))
    }
  }
  return null
}
