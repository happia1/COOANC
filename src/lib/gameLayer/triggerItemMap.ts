/**
 * 게임 레이어: 트리거 키 타입 + 아이템 인덱스 매핑
 *
 * item_index 는 ASSETS.characters.decorItemImages 배열의 인덱스(0-based)와 일치합니다.
 * null = 해당 트리거에 연결된 아이템 없음
 */
export type TriggerKey =
  | 'FIRST_MISSION'
  | 'FIRST_SAVE'
  | 'FIRST_WALLET_USE'
  | 'ADD_TO_CART'
  | 'FIRST_PURCHASE'
  /**
   * 스페셜(골드) 미션 카드를 누적 5회 이상 완료했을 때 1회 발동.
   * 비개발자: 골드 카드 5장을 달성하면 자동 칭찬 스티커 지급 게이트로 씁니다.
   */
  | 'SPECIAL_GOLD_CARD_5'

/**
 * 새 꾸미기 PNG 목록(인덱스 의미 변경)과 「지금은 전부 잠금」 단계에 맞춰,
 * 자동 잠금 해제는 잠시 끕니다. 조건을 정한 뒤 아래 숫자를 `decorItemImages` 배열 인덱스(0부터)로 다시 채우면 됩니다.
 */
export const TRIGGER_TO_ITEM: Record<TriggerKey, number | null> = {
  FIRST_MISSION:    null,
  FIRST_SAVE:       null,
  FIRST_WALLET_USE: null,
  ADD_TO_CART:      null,
  FIRST_PURCHASE:   null,
  SPECIAL_GOLD_CARD_5: null,
}
