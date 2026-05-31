/**
 * 베타 마켓 설정
 *
 * 비개발자 설명:
 * - 베타 기간에는 전체 상품 중 일부만 자녀 마켓에 노출합니다.
 * - 여기에 적힌 이름(DB name 값과 정확히 일치)만 자녀 화면에 보입니다.
 * - 부모 메뉴 제어 화면에서는 허용 목록 외 상품에 「준비중」 표시가 붙습니다.
 * - 간식 순서는 아래 배열 순서와 같습니다(MVP).
 */

import { isChildContentMarketItemActive } from '@/constants/childContentMenu'

/** DB store_items.name 값과 정확히 일치해야 합니다 */
export const BETA_MARKET_CONFIG = {
  /** 자녀앱에 노출할 간식 목록 (건강간식 카탈로그 하위, 순서 고정) */
  activeFood: [
    '견과류',
    '어린이 육포',
    '스트링치즈',
    '뮤즐리',
    '그릭요거트',
    '팝콘',
    '비타민 구미',
    '어린이 영양제',
    '과일 푸딩',
    '초콜릿',
    '초코볼',
    '딸기우유',
    '초코우유',
    '망고 주스',
    '딸기 주스',
    '블루베리 주스',
    '아이스크림',
    '칩스',
    '크래커',
    '츄잉캔디',
  ],

  /** 자녀앱에 노출할 이벤트/체험 목록 (`073_store_catalog` 이벤트 행과 동일 이름) */
  activeEvents: ['엄마 뽀뽀', '아빠 뽀뽀', '책 읽어주세요', '안아주세요'],

  /** 자녀앱에 노출할 콘텐츠 이용권 목록 (간식 다음 구역) */
  activeContent: ['영상 시청권 30분', '미니게임 이용권'],

  /** 자녀앱에서 완전히 숨길 카테고리 — 장난감은 비활성 유지 + 목록에서 숨김 */
  hiddenCategoriesChild: ['toy'] as string[],

  /** 부모앱에서 준비중으로 표시할 카테고리 */
  blockedCategoriesParent: ['toy'] as string[],

  /**
   * 부모 메뉴 제어에서 「준비중」 오버레이 (자녀앱 노출은 `childContentMenu` 의 available 과 연동)
   * DB store_items.name 과 정확히 일치해야 합니다.
   */
  parentPreparingItems: ['미니게임 이용권'] as const,
} as const

export type BetaMarketConfig = typeof BETA_MARKET_CONFIG

/**
 * 해당 상품이 베타 활성화 목록에 있는지 확인합니다.
 * - food 카테고리: activeFood 목록에 있는 경우 true
 * - experience/activity 카테고리: activeEvents 목록에 있는 경우 true
 * - content 카테고리: activeContent 목록 + `childContentMenu` available
 * - toy 등 나머지: false
 */
/** 부모 메뉴 제어에서 타일만 준비중 처리 (자녀 마켓과 분리) */
export function isParentPreparingMarketItem(name: string): boolean {
  return (BETA_MARKET_CONFIG.parentPreparingItems as readonly string[]).includes(name)
}

export function isBetaActive(name: string, category: string): boolean {
  if (category === 'food') {
    const canonical = canonicalSnackCatalogName(name)
    return (BETA_MARKET_CONFIG.activeFood as readonly string[]).includes(canonical)
  }
  if (category === 'content') {
    if (!(BETA_MARKET_CONFIG.activeContent as readonly string[]).includes(name)) return false
    return isChildContentMarketItemActive(name)
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
  const canonical = canonicalSnackCatalogName(name)
  const i = (BETA_MARKET_CONFIG.activeFood as readonly string[]).indexOf(canonical)
  return i === -1 ? 10_000 : i
}

/** 이벤트 마켓 노출 순서 — `activeEvents` 배열 순서(0부터) */
export function activeEventSortIndex(name: string): number {
  const i = (BETA_MARKET_CONFIG.activeEvents as readonly string[]).indexOf(name)
  return i === -1 ? 10_000 : i
}

/** 콘텐츠 마켓 노출 순서 — `activeContent` 배열 순서(0부터) */
export function activeContentSortIndex(name: string): number {
  const i = (BETA_MARKET_CONFIG.activeContent as readonly string[]).indexOf(name)
  return i === -1 ? 10_000 : i
}

/** DB 마이그레이션 전 예전 상품명 → 화면에 보여 줄 이름 */
const SNACK_DISPLAY_NAME_ALIASES: Record<string, string> = {
  텐텐: '어린이 영양제',
  치즈: '스트링치즈',
  젤리: '비타민 구미',
  육포: '어린이 육포',
  '바삭 칩스': '칩스',
  과자: '칩스',
  푸딩: '과일 푸딩',
  츄잉껌: '츄잉캔디',
  츄잉검: '츄잉캔디',
}

export function storeItemDisplayName(name: string): string {
  return SNACK_DISPLAY_NAME_ALIASES[name] ?? name
}

/** `activeFood` 매칭용 — 예전 DB 이름도 현재 카탈로그 이름으로 인식 */
export function canonicalSnackCatalogName(name: string): string {
  return SNACK_DISPLAY_NAME_ALIASES[name] ?? name
}
