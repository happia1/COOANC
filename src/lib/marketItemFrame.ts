import { MARKET_ITEMS } from '@/constants/sprites'

/**
 * 마켓 상품 스프라이트(market_items.png) 안의 프레임 이름 타입입니다.
 * (TexturePacker 가 만든 키 이름 그대로입니다.)
 */
export type MarketItemFrameKey = keyof typeof MARKET_ITEMS.frames

/**
 * 진열대에 올라갈 수 있는 상품 그림 키 목록입니다.
 * 한 줄 설명: 같은 상품이 항상 같은 그림을 쓰도록, 상품 id 문자열로 목록 인덱스를 고릅니다.
 */
const ITEM_FRAMES: MarketItemFrameKey[] = [
  'chips',
  'chew',
  'choco_milk',
  'chocolate',
  'gummy',
  'icecream',
  'drink',
  'candy',
  'coockie',
  'bluberry_juice',
  'strawberry_milk',
  'bear',
  'chew2',
  'pudding',
  'blocks',
  'mango_juice',
  'strawberry_juice',
  'luckybox',
  'flower',
  '레이어 9',
  '레이어 10',
  'chocolate (2)',
]

/**
 * 상품 UUID(또는 이름)로부터 안정적인 스프라이트 키를 고릅니다.
 * - DB에 그림 필드가 없어도 카드·승인 카드에서 같은 상품은 같은 일러스트를 씁니다.
 */
export function marketFrameKeyForItemId(itemId: string | null, itemName: string): MarketItemFrameKey {
  const key = (itemId ?? itemName).trim() || 'default'
  let h = 0
  for (let i = 0; i < key.length; i++) {
    h = (Math.imul(31, h) + key.charCodeAt(i)) | 0
  }
  const idx = Math.abs(h) % ITEM_FRAMES.length
  return ITEM_FRAMES[idx]
}
