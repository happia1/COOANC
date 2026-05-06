import { assetImg } from './assets'

/**
 * 마켓 상품에 `image_url` 이 없을 때 보여 줄 기본 그림입니다.
 * 실물 파일은 `public/assets/img/items/shop/items/` 아래
 * `건강간식` · `이벤트` · `장난감` 폴더를 씁니다 (DB 시드와 동일 경로).
 */

const H = (...file: string[]) => assetImg('items', 'shop', 'items', '건강간식', ...file)
const E = (...file: string[]) => assetImg('items', 'shop', 'items', '이벤트', ...file)
const T = (...file: string[]) => assetImg('items', 'shop', 'items', '장난감', ...file)

export const MARKET_ITEM_IMAGE_URLS = {
  // ── 건강간식 (파일명 키 + 자주 쓰는 상품명 키)
  bluberry_juice: H('bluberry_juice.png'),
  candy: H('chocolate.png'),
  chew: H('chew.png'),
  chew2: H('chew.png'),
  chips: H('chips.png'),
  choco_milk: H('choco_milk.png'),
  chocoball: H('chocoball.png'),
  'chocolate (2)': H('chocolate.png'),
  chocolate: H('chocolate.png'),
  coockie: H('chips.png'),
  drink: H('drink.png'),
  flower: E('hug.png'),
  gummy: H('젤리.png'),
  icecream: H('icecream.png'),
  kinderjoy_chocolate: H('chocolate.png'),
  luckybox: T('toys.png'),
  mango_juice: H('mango_juice.png'),
  pudding: H('pudding.png'),
  strawberry_juice: H('strawberry_juice.png'),
  strawberry_milk: H('strawberry_milk.png'),
  bear: T('bear.png'),
  blocks: T('train_toy.png'),
  toys: T('toys.png'),

  /** 한글 상품명으로 폴백할 때 (일부 화면에서 이름 기반 표시) */
  견과류: H('견과류.png'),
  초콜릿: H('chocolate.png'),
  텐텐: H('텐텐.png'),
  치즈: H('치즈.png'),
  육포: H('육포.png'),
  그릭요거트: H('그릭요거트.png'),
  뮤즐리: H('뮤즐리.png'),
  젤리: H('젤리.png'),
  팝콘: H('팝콘.png'),
  음료수: H('drink.png'),
  츄잉껌: H('chew.png'),
  초코우유: H('choco_milk.png'),
  딸기우유: H('strawberry_milk.png'),
  바삭칩스: H('chips.png'),

  엄마뽀뽀: E('mom_chu.png'),
  아빠뽀뽀: E('papa_chu.png'),
  책읽어주세요: E('read_book.png'),
  안아주세요: E('hug.png'),
} as const

/** 위 PNG 목록의 키 — 상품별 기본 그림을 고를 때 씁니다 */
export type MarketItemImageKey = keyof typeof MARKET_ITEM_IMAGE_URLS

/** 키에 해당하는 브라우저용 정적 URL */
export function marketItemImageUrl(key: MarketItemImageKey): string {
  return MARKET_ITEM_IMAGE_URLS[key]
}
