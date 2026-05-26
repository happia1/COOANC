/**
 * 자녀 앱 단일 화면 기능 해금 정의
 *
 * 비개발자 설명:
 * - 아이의 나이(ageYears)나 레벨(current_level)에 따라 어떤 기능을 보여줄지 결정합니다.
 * - 예: 레벨 5 미만이면 코인(돈바구니/저금통/지갑) 기능을 숨깁니다.
 * - 이 함수의 반환값으로 상단 바 아이콘을 표시하거나 숨깁니다.
 */

export type UnlockedFeatures = {
  /** 미션 카드 — 항상 노출 */
  missions: boolean
  /** 마켓 — 항상 노출 (상품 구경은 연령 무관) */
  market: boolean
  /**
   * 코인 팝업 (돈바구니/저금통/지갑):
   * 레벨 5 이상일 때만 노출
   */
  coinPocket: boolean
  /** 캐릭터 꾸미기: 레벨 2 이상 */
  dressUp: boolean
  /** 칭찬 스티커 판: 레벨 1 이상 */
  sticker: boolean
}

/**
 * 자녀 나이(세) 또는 current_level 기준 해금된 기능을 반환합니다.
 *
 * @param level child_stats.current_level (0~99)
 * @param ageYears 만 나이(세). 현재 해금 규칙에서는 사용하지 않지만 시그니처 호환을 위해 유지합니다.
 */
export function getUnlockedFeatures(level: number, ageYears: number | null): UnlockedFeatures {
  /** 비개발자: 저금통(코인 팝업)은 레벨 5부터 열립니다. */
  const coinPocketUnlocked = level >= 5
  void ageYears

  return {
    missions: true,
    market: true,
    coinPocket: coinPocketUnlocked,
    dressUp: level >= 2,
    sticker: level >= 1,
  }
}
