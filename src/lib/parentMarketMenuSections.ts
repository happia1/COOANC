import type { StoreItem } from '@/types/database'

/** DB `store_items.category` 와 동일한 값 */
export type StoreItemCategory = NonNullable<StoreItem['category']>

/**
 * 마켓(부모 메뉴 제어·자녀 마켓 탭)에 올리지 않는 카테고리.
 * 캐릭터 꾸미기(digital)는 홈 탭에서 별도 구매 흐름으로 둡니다.
 */
export const STORE_ITEM_CATEGORIES_EXCLUDED_FROM_MARKET: ReadonlySet<StoreItemCategory> = new Set(['digital'])

export function isCategoryExcludedFromMarket(category: StoreItem['category']): boolean {
  return category != null && STORE_ITEM_CATEGORIES_EXCLUDED_FROM_MARKET.has(category)
}

/**
 * 부모 「메뉴 제어」·자녀 마켓에서 보여 줄 카테고리 묶음입니다.
 * - DB 의 activity·experience 는 화면에서 「이벤트」 한 덩어리로 묶습니다.
 */
export type ParentMarketSectionId = 'snack' | 'toy' | 'event' | 'other'

export const PARENT_MARKET_MENU_SECTIONS: {
  id: ParentMarketSectionId
  title: string
  /** 이 행에 넣을 DB category 값들 */
  dbCategories: readonly StoreItemCategory[]
}[] = [
  { id: 'snack', title: '간식', dbCategories: ['food'] },
  { id: 'toy', title: '장난감', dbCategories: ['toy'] },
  { id: 'event', title: '이벤트', dbCategories: ['activity', 'experience'] },
]

const ALL_DB: Set<string> = new Set(PARENT_MARKET_MENU_SECTIONS.flatMap((s) => s.dbCategories))

/** 상품 한 개가 어느 메뉴 구역에 속하는지 (마켓에 노출되는 카테고리만) */
export function parentMarketSectionIdForItem(category: StoreItem['category']): ParentMarketSectionId {
  if (category == null || !ALL_DB.has(category)) {
    return 'other'
  }
  for (const sec of PARENT_MARKET_MENU_SECTIONS) {
    if (sec.dbCategories.includes(category)) {
      return sec.id
    }
  }
  return 'other'
}

/** 상품 추가 폼용 — DB 값 + 화면 라벨 (마켓 전용, digital 제외) */
export const PARENT_ADD_ITEM_CATEGORY_OPTIONS: {
  value: StoreItemCategory
  label: string
}[] = [
  { value: 'food', label: '간식' },
  { value: 'toy', label: '장난감' },
  { value: 'activity', label: '이벤트 · 활동' },
  { value: 'experience', label: '이벤트 · 특별 체험' },
]
