import { assetImg } from './assets'
import { canonicalSnackCatalogName } from './betaMarketConfig'

/**
 * 마켓 상품에 `image_url` 이 없을 때 보여 줄 기본 그림입니다.
 * 실물 파일은 `public/assets/img/items/shop/items/` 아래
 * `건강간식` · `이벤트` · `콘텐츠` · `장난감` 폴더를 씁니다 (DB 시드와 동일 경로).
 */

const H = (...file: string[]) => assetImg('items', 'shop', 'items', '건강간식', ...file)
const E = (...file: string[]) => assetImg('items', 'shop', 'items', '이벤트', ...file)
const C = (...file: string[]) => assetImg('items', 'shop', 'items', '콘텐츠', ...file)
const T = (...file: string[]) => assetImg('items', 'shop', 'items', '장난감', ...file)

export const MARKET_ITEM_IMAGE_URLS = {
  // ── 건강간식 (파일명 키 + 자주 쓰는 상품명 키)
  bluberry_juice: H('bluberry_juice.png'),
  candy: H('chocolate.png'),
  chew: H('chew.png'),
  chew2: H('chew.png'),
  chips: H('chips.png'),
  cracker: H('cracker.png'),
  choco_milk: H('choco_milk.png'),
  chocoball: H('chocoball.png'),
  'chocolate (2)': H('chocolate.png'),
  chocolate: H('chocolate.png'),
  coockie: H('chips.png'),
  drink: H('drink.png'),
  flower: E('hug.png'),
  gummy: H('젤리.png'),
  icecream: H('icepop.png'),
  stringcheese: H('stringcheese.png'),
  vitamine: H('vitamine.png'),
  icepop: H('icepop.png'),
  kinderjoy_chocolate: H('chocolate.png'),
  luckybox: T('toys.png'),
  mango_juice: H('mango_juice.png'),
  pudding: H('pudding.png'),
  strawberry_juice: H('strawberry_juice.png'),
  strawberry_milk: H('strawberry_milk.png'),
  bear: T('bear.png'),
  blocks: T('train_toy.png'),
  toys: T('toys.png'),

  /** 한글 상품명 — DB `store_items.name` 과 동일하게(공백 포함) */
  견과류: H('견과류.png'),
  초콜릿: H('chocolate.png'),
  '어린이 영양제': H('vitamine.png'),
  스트링치즈: H('stringcheese.png'),
  '어린이 육포': H('육포.png'),
  그릭요거트: H('그릭요거트.png'),
  뮤즐리: H('뮤즐리.png'),
  '비타민 구미': H('젤리.png'),
  팝콘: H('팝콘.png'),
  츄잉캔디: H('chew.png'),
  초코우유: H('choco_milk.png'),
  딸기우유: H('strawberry_milk.png'),
  칩스: H('chips.png'),
  크래커: H('cracker.png'),
  초코볼: H('chocoball.png'),
  '블루베리 주스': H('bluberry_juice.png'),
  '망고 주스': H('mango_juice.png'),
  '딸기 주스': H('strawberry_juice.png'),
  '과일 푸딩': H('pudding.png'),
  아이스크림: H('icepop.png'),
  /** 구매 이력 등 예전 스냅샷 이름 */
  치즈: H('stringcheese.png'),
  과자: H('chips.png'),
  '바삭 칩스': H('chips.png'),
  푸딩: H('pudding.png'),
  음료수: H('drink.png'),
  텐텐: H('vitamine.png'),
  젤리: H('젤리.png'),
  육포: H('육포.png'),
  츄잉껌: H('chew.png'),

  엄마뽀뽀: E('mom_chu.png'),
  아빠뽀뽀: E('papa_chu.png'),
  책읽어주세요: E('read_book.png'),
  안아주세요: E('hug.png'),
  '영상 시청권 30분': C('contents.png'),
  '미니게임 이용권': C('minigame.png'),
  contents: C('contents.png'),
  minigame: C('minigame.png'),
  /** 구매 이력 등 예전 이름 */
  '콘텐츠 30분 이용권': C('contents.png'),
  '콘텐츠 이용권 30분': C('contents.png'),
} as const

/** 위 PNG 목록의 키 — 상품별 기본 그림을 고를 때 씁니다 */
export type MarketItemImageKey = keyof typeof MARKET_ITEM_IMAGE_URLS

/** 키에 해당하는 브라우저용 정적 URL */
export function marketItemImageUrl(key: MarketItemImageKey): string {
  return MARKET_ITEM_IMAGE_URLS[key]
}

function isMarketItemImageKey(name: string): name is MarketItemImageKey {
  return Object.prototype.hasOwnProperty.call(MARKET_ITEM_IMAGE_URLS, name)
}

/**
 * 카탈로그 상품명으로 기본 일러스트 키를 찾습니다.
 * (예전 DB 이름 alias 도 `MARKET_ITEM_IMAGE_URLS` 에 포함)
 */
export function marketFrameKeyForItemName(itemName: string): MarketItemImageKey | null {
  const trimmed = canonicalSnackCatalogName(itemName.trim())
  if (!trimmed) return null
  return isMarketItemImageKey(trimmed) ? trimmed : null
}

/**
 * 화면에 쓸 상품 이미지 URL — 카탈로그 이름 매핑을 DB `image_url` 보다 우선합니다.
 * (마이그레이션 전에도 `vitamine.png`·`stringcheese.png` 등이 바로 보이게)
 */
export function resolveStoreItemImageUrl(
  itemName: string,
  imageUrl: string | null | undefined,
): string | null {
  const fromName = marketFrameKeyForItemName(itemName)
  if (fromName) return MARKET_ITEM_IMAGE_URLS[fromName]
  const trimmed = imageUrl?.trim()
  return trimmed || null
}
