/**
 * 보물상자(콘텐츠) 팝업 메뉴 항목
 *
 * 비개발자 설명:
 * - 자녀가 보물상자 아이콘을 누르면 나오는 목록입니다.
 * - 「영상 보기」는 레벨 무관 상시 이용 가능, 「미니게임」은 레벨 10부터 열립니다.
 * - `available` 은 더 이상 정적 값이 아니라 `isChildContentMenuAvailable(id, level)` 로 계산합니다.
 */

export type ChildContentMenuItemId = 'video' | 'minigame'

export type ChildContentMenuItem = {
  id: ChildContentMenuItemId
  title: string
  description: string
  /** 메뉴 카드에 쓸 이미지(없으면 이모지/텍스트만) */
  imageUrl?: string
}

/** 영상 시청권 일러스트 */
export const CONTENT_VIDEO_TICKET_IMAGE_URL = '/assets/img/items/shop/items/콘텐츠/contents.png'

/** 미니게임 이용권 일러스트 */
export const CONTENT_MINIGAME_TICKET_IMAGE_URL = '/assets/img/items/shop/items/콘텐츠/minigame.png'

/** 미니게임 메뉴가 열리는 최소 레벨 */
export const MINIGAME_UNLOCK_LEVEL = 10

export const CHILD_CONTENT_MENU_ITEMS: ChildContentMenuItem[] = [
  {
    id: 'video',
    title: '영상 보기',
    description: '약속 시간만큼 영상 플레이',
    imageUrl: CONTENT_VIDEO_TICKET_IMAGE_URL,
  },
  {
    id: 'minigame',
    title: '미니게임',
    description: '두뇌 개발 게임 플레이',
    imageUrl: CONTENT_MINIGAME_TICKET_IMAGE_URL,
  },
]

/** 보물상자 메뉴 항목 사용 가능 여부 — 미니게임은 레벨 10부터 */
export function isChildContentMenuAvailable(id: ChildContentMenuItemId, level: number): boolean {
  if (id === 'minigame') return level >= MINIGAME_UNLOCK_LEVEL
  return true
}

/**
 * 자녀 마켓 콘텐츠 이용권(보물상자 이용권) 노출 여부.
 * 레벨 게이트는 보물상자 팝업의 「미니게임」 메뉴 진입에만 적용되고,
 * 이용권 구매 자체는 레벨과 무관하게 항상 가능합니다.
 */
export function isChildContentMarketItemActive(_storeItemName: string): boolean {
  return true
}

/** 우측 상단 보물상자 아이콘 */
export const CHILD_CONTENT_TREASURE_ICON_URL = '/assets/img/items/stickers/treasure.png'
