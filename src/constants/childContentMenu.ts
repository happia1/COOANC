/**
 * 보물상자(콘텐츠) 팝업 메뉴 항목
 *
 * 비개발자 설명:
 * - 자녀가 보물상자 아이콘을 누르면 나오는 목록입니다.
 * - 「영상 보기」는 지금 사용할 수 있고, 「미니게임」 등은 나중에 추가할 자리입니다.
 * - `available: false` 인 항목은 자녀 마켓·보물상자 배지에서도 비활성으로 취급합니다.
 */

import {
  MINIGAME_PLAY_PASS_ITEM_NAME,
  VIDEO_VIEWING_PASS_ITEM_NAME,
} from '@/lib/contentTickets'

export type ChildContentMenuItemId = 'video' | 'minigame'

export type ChildContentMenuItem = {
  id: ChildContentMenuItemId
  title: string
  description: string
  /** 메뉴 카드에 쓸 이미지(없으면 이모지/텍스트만) */
  imageUrl?: string
  /** false 이면 「준비 중」 안내만 표시 */
  available: boolean
}

/** 영상 시청권 일러스트 */
export const CONTENT_VIDEO_TICKET_IMAGE_URL = '/assets/img/items/shop/items/콘텐츠/contents.png'

/** 미니게임 이용권 일러스트 */
export const CONTENT_MINIGAME_TICKET_IMAGE_URL = '/assets/img/items/shop/items/콘텐츠/minigame.png'

export const CHILD_CONTENT_MENU_ITEMS: ChildContentMenuItem[] = [
  {
    id: 'video',
    title: '영상 보기',
    description: '약속 시간만큼 영상 플레이',
    imageUrl: CONTENT_VIDEO_TICKET_IMAGE_URL,
    available: true,
  },
  {
    id: 'minigame',
    title: '미니게임',
    description: '두뇌 개발 게임 플레이',
    imageUrl: CONTENT_MINIGAME_TICKET_IMAGE_URL,
    available: false,
  },
]

/** 보물상자 메뉴 항목 사용 가능 여부 */
export function isChildContentMenuAvailable(id: ChildContentMenuItemId): boolean {
  return CHILD_CONTENT_MENU_ITEMS.find((m) => m.id === id)?.available ?? false
}

/**
 * 자녀 마켓 콘텐츠 이용권 노출 여부 — 보물상자 `available` 과 동일 기준
 * (활성화 시 `CHILD_CONTENT_MENU_ITEMS` 의 minigame.available 만 true 로 바꾸면 됩니다)
 */
export function isChildContentMarketItemActive(storeItemName: string): boolean {
  const name = storeItemName.trim()
  if (name === MINIGAME_PLAY_PASS_ITEM_NAME) return isChildContentMenuAvailable('minigame')
  if (name === VIDEO_VIEWING_PASS_ITEM_NAME) return isChildContentMenuAvailable('video')
  return true
}

/** 우측 상단 보물상자 아이콘 */
export const CHILD_CONTENT_TREASURE_ICON_URL = '/assets/img/items/stickers/treasure.png'
