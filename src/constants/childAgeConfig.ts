/**
 * 연령·레벨에 따른 크레딧 「단일 버킷」 vs 「지갑/저금통/돈바구니 3분할」 전환
 *
 * 비개발자 설명:
 * - 레벨이 낮을 때(레벨 5 미만)는 코인을 한 덩어리(`credits`)로만 씁니다.
 * - 나이·레벨이 일정 이상이면 돈바구니·지갑·저금통을 나누는 모드(멀티 버킷)를 씁니다.
 */

// 단일 크레딧 모드 (3버킷 비활성)
// current_level < MULTI_BUCKET_MIN_LEVEL 이면 credits 단일 버킷 사용
// 비개발자: 저금통/지갑은 레벨 5부터 열립니다.
export const MULTI_BUCKET_MIN_LEVEL = 5

export function usesSingleBucket(level: number, ageYears?: number | null): boolean {
  /**
   * ageYears 파라미터는 기존 호출부 호환을 위해 유지합니다.
   * 현재 정책에서는 저금통 해금을 레벨 기준으로만 판단합니다.
   */
  void ageYears
  return level < MULTI_BUCKET_MIN_LEVEL
}

/** `birth_date` → 만 나이(세) 러프 추정용 1년 길이(ms) */
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000

/**
 * `profiles` 행(자녀 본인 id)에서 만 나이(세)를 뽑습니다.
 * - `age`가 숫자로 있으면 그대로(내림) 사용
 * - 없으면 `birth_date`로 러프 계산
 * - 둘 다 없으면 null → `usesSingleBucket`은 레벨만으로 판단
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
