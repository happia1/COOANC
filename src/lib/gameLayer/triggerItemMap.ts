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

export const TRIGGER_TO_ITEM: Record<TriggerKey, number | null> = {
  FIRST_MISSION:    4,
  FIRST_SAVE:       0,
  FIRST_WALLET_USE: 1,
  ADD_TO_CART:      2,
  FIRST_PURCHASE:   3,
  // 인덱스 5~7: Phase 3 항해 마일스톤 예약
}
