import type { MarketItemImageKey } from '@/constants/marketItemImages'
import { marketFrameKeyForItemName } from '@/constants/marketItemImages'
import { canonicalSnackCatalogName } from '@/constants/betaMarketConfig'

/**
 * 상품 UUID(또는 이름)로 골라 쓰는 마켓 기본 그림 키 타입입니다.
 * (DB `image_url` 이 없을 때만 이 키로 PNG 를 고릅니다.)
 */
export type MarketItemFrameKey = MarketItemImageKey

/**
 * 진열대에 올라갈 수 있는 상품 그림 키 목록입니다.
 * 한 줄 설명: 같은 상품이 항상 같은 그림을 쓰도록, 상품 id 문자열로 목록 인덱스를 고릅니다.
 * 예전 스프라이트의 `레이어 9/10` 대신 폴더에 있는 `kinderjoy_chocolate`, `toys` 를 넣었습니다.
 */
const ITEM_FRAMES: MarketItemImageKey[] = [
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
  'kinderjoy_chocolate',
  'toys',
  'chocolate (2)',
]

/**
 * 상품 UUID(또는 이름)로부터 안정적인 그림 키를 고릅니다.
 * - DB에 그림 필드가 없어도 카드·승인 카드에서 같은 상품은 같은 일러스트를 씁니다.
 */
export function marketFrameKeyForItemId(itemId: string | null, itemName: string): MarketItemFrameKey {
  const fromName = marketFrameKeyForItemName(canonicalSnackCatalogName(itemName))
  if (fromName) return fromName

  const key = (itemId ?? itemName).trim() || 'default'
  let h = 0
  for (let i = 0; i < key.length; i++) {
    h = (Math.imul(31, h) + key.charCodeAt(i)) | 0
  }
  const idx = Math.abs(h) % ITEM_FRAMES.length
  return ITEM_FRAMES[idx]
}
