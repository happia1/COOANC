/**
 * 자녀 앱 단일 화면 기능 해금 정의
 *
 * 비개발자 설명:
 * - 아이의 나이(ageYears)나 레벨(current_level)에 따라 어떤 기능을 보여줄지 결정합니다.
 * - 예: 만 7세 미만이거나 레벨 1 이하면 코인(돈바구니/저금통/지갑) 기능을 숨깁니다.
 * - 이 함수의 반환값으로 상단 바 아이콘을 표시하거나 숨깁니다.
 */

export type UnlockedFeatures = {
  /** 미션 카드 — 항상 노출 */
  missions: boolean
  /** 마켓 — 항상 노출 (상품 구경은 연령 무관) */
  market: boolean
  /**
   * 코인 팝업 (돈바구니/저금통/지갑):
   * 만 7세 이상이고 레벨 2 이상일 때만 노출
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
 * @param level child_stats.current_level (0~5)
 * @param ageYears 만 나이(세). null 이면 레벨로만 판단합니다.
 */
export function getUnlockedFeatures(level: number, ageYears: number | null): UnlockedFeatures {
  /**
   * isYoung: 만 7세 미만이거나 레벨이 1 이하인 경우
   * - ageYears 가 있으면 나이 우선, 없으면 레벨로 판단합니다.
   */
  const isYoung = ageYears !== null ? ageYears < 7 : level <= 1

  return {
    missions: true,
    market: true,
    coinPocket: !isYoung && level >= 2,
    dressUp: level >= 2,
    sticker: level >= 1,
  }
}
