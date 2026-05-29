/**
 * 베타 마켓 설정
 *
 * 비개발자 설명:
 * - 베타 기간에는 전체 상품 중 일부만 자녀 마켓에 노출합니다.
 * - 여기에 적힌 이름(DB name 값과 정확히 일치)만 자녀 화면에 보입니다.
 * - 부모 메뉴 제어 화면에서는 허용 목록 외 상품에 「준비중」 표시가 붙습니다.
 * - 간식 순서는 아래 배열 순서와 같습니다(MVP).
 */

/** DB store_items.name 값과 정확히 일치해야 합니다 */
export const BETA_MARKET_CONFIG = {
  /** 자녀앱에 노출할 간식 목록 (건강간식 카탈로그 하위, 순서 고정) */
  activeFood: [
    '견과류',
    '초콜릿',
    '어린이 영양제',
    '치즈',
    '어린이 육포',
    '그릭요거트',
    '뮤즐리',
    '비타민 구미',
    '팝콘',
    '음료수',
    '츄잉캔디',
    '초코우유',
    '딸기우유',
  ],

  /** 자녀앱에 노출할 이벤트/체험 목록 (`073_store_catalog` 이벤트 행과 동일 이름) */
  activeEvents: ['엄마 뽀뽀', '아빠 뽀뽀', '책 읽어주세요', '안아주세요'],

  /** 자녀앱에서 완전히 숨길 카테고리 — 장난감은 비활성 유지 + 목록에서 숨김 */
  hiddenCategoriesChild: ['toy'] as string[],

  /** 부모앱에서 준비중으로 표시할 카테고리 */
  blockedCategoriesParent: ['toy'] as string[],
} as const

export type BetaMarketConfig = typeof BETA_MARKET_CONFIG

/**
 * 해당 상품이 베타 활성화 목록에 있는지 확인합니다.
 * - food 카테고리: activeFood 목록에 있는 경우 true
 * - experience/activity 카테고리: activeEvents 목록에 있는 경우 true
 * - toy 등 나머지: false
 */
export function isBetaActive(name: string, category: string): boolean {
  if (category === 'food') {
    return (BETA_MARKET_CONFIG.activeFood as readonly string[]).includes(name)
  }
  if (category === 'experience' || category === 'activity') {
    return (BETA_MARKET_CONFIG.activeEvents as readonly string[]).includes(name)
  }
  return false
}

/**
 * 부모 메뉴 제어 간식 목록 정렬용 — `activeFood` 배열 순서(0부터).
 * 목록에 없으면 큰 값(뒤로 밀림).
 */
export function activeFoodSortIndex(name: string): number {
  const i = (BETA_MARKET_CONFIG.activeFood as readonly string[]).indexOf(name)
  return i === -1 ? 10_000 : i
}
