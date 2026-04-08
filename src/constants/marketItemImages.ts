import { assetImg } from './assets'

/**
 * 마켓 상품에 `image_url` 이 없을 때 보여 줄 기본 그림입니다.
 * 파일은 `public/assets/img/items/shop/items/` 아래 PNG 와 이름이 정확히 같아야 합니다.
 * (예: 키 `chocolate (2)` → 파일 `chocolate (2).png`)
 */
export const MARKET_ITEM_IMAGE_URLS = {
  bear: assetImg('items', 'shop', 'items', 'bear.png'),
  blocks: assetImg('items', 'shop', 'items', 'blocks.png'),
  /** 파일명이 bluberry 로 되어 있어 그대로 맞춥니다 */
  bluberry_juice: assetImg('items', 'shop', 'items', 'bluberry_juice.png'),
  candy: assetImg('items', 'shop', 'items', 'candy.png'),
  chew: assetImg('items', 'shop', 'items', 'chew.png'),
  chew2: assetImg('items', 'shop', 'items', 'chew2.png'),
  chips: assetImg('items', 'shop', 'items', 'chips.png'),
  choco_milk: assetImg('items', 'shop', 'items', 'choco_milk.png'),
  'chocolate (2)': assetImg('items', 'shop', 'items', 'chocolate (2).png'),
  chocolate: assetImg('items', 'shop', 'items', 'chocolate.png'),
  /** 파일명이 coockie 로 되어 있어 그대로 맞춥니다 */
  coockie: assetImg('items', 'shop', 'items', 'coockie.png'),
  drink: assetImg('items', 'shop', 'items', 'drink.png'),
  flower: assetImg('items', 'shop', 'items', 'flower.png'),
  gummy: assetImg('items', 'shop', 'items', 'gummy.png'),
  icecream: assetImg('items', 'shop', 'items', 'icecream.png'),
  kinderjoy_chocolate: assetImg('items', 'shop', 'items', 'kinderjoy_chocolate.png'),
  luckybox: assetImg('items', 'shop', 'items', 'luckybox.png'),
  mango_juice: assetImg('items', 'shop', 'items', 'mango_juice.png'),
  pudding: assetImg('items', 'shop', 'items', 'pudding.png'),
  strawberry_juice: assetImg('items', 'shop', 'items', 'strawberry_juice.png'),
  strawberry_milk: assetImg('items', 'shop', 'items', 'strawberry_milk.png'),
  toys: assetImg('items', 'shop', 'items', 'toys.png'),
} as const

/** 위 PNG 목록의 키 — 상품별 기본 그림을 고를 때 씁니다 */
export type MarketItemImageKey = keyof typeof MARKET_ITEM_IMAGE_URLS

/** 키에 해당하는 브라우저용 정적 URL */
export function marketItemImageUrl(key: MarketItemImageKey): string {
  return MARKET_ITEM_IMAGE_URLS[key]
}
