/**
 * public/ 아래 정적 이미지 경로를 한곳에서 관리합니다.
 * Next.js에서는 public 루트가 / 이므로 URL은 항상 / 로 시작합니다.
 *
 * 사용 예: <Image src={ASSETS.common.ui.iconHome} alt="" width={24} height={24} />
 * 파일을 추가할 때는 이 객체에 파일명 상수를 덧붙이면 됩니다.
 */

/** 이미지 루트 (public/assets/img → 웹 경로) */
export const ASSETS_IMG_BASE = '/assets/img' as const

/** 경로 조각을 이어붙입니다. 선행·중복 슬래시는 정리하지 않으니 ASSETS_* 만 쓰는 것을 권장합니다. */
export function assetImg(...segments: string[]): string {
  const tail = segments.filter(Boolean).join('/')
  return tail ? `${ASSETS_IMG_BASE}/${tail}` : ASSETS_IMG_BASE
}

/**
 * 대분류별 디렉터리(폴더) 경로.
 * 실제 png/svg 파일명은 하위에 example 처럼 추가하면 됩니다.
 */
export const ASSETS = {
  /** 공통 UI·장식 (아이콘, 날짜, 손가락·박수 등) */
  common: {
    root: `${ASSETS_IMG_BASE}/common`,
    ui: `${ASSETS_IMG_BASE}/common/ui`,
    date: `${ASSETS_IMG_BASE}/common/date`,
    gestures: `${ASSETS_IMG_BASE}/common/gestures`,
    // 예시: iconHome: `${ASSETS_IMG_BASE}/common/ui/icon-home.svg`,
  },

  /** 캐릭터·모드·온보딩 */
  characters: {
    root: `${ASSETS_IMG_BASE}/characters`,
    base: `${ASSETS_IMG_BASE}/characters/base`,
    modes: `${ASSETS_IMG_BASE}/characters/modes`,
    onboarding: `${ASSETS_IMG_BASE}/characters/onboarding`,
    /**
     * 홈 「내 캐릭터 꾸미기」용 아이템 PNG — `public/assets/img/characters/items/` 안 파일을 1번부터 순서대로 씁니다.
     * (파일명에 공백이 있어도 웹 경로로는 그대로 사용 가능합니다.)
     */
    decorItemImages: [
      assetImg('characters', 'items', 'items (1).png'),
      assetImg('characters', 'items', 'items (2).png'),
      assetImg('characters', 'items', 'items (3).png'),
      assetImg('characters', 'items', 'items (4).png'),
      assetImg('characters', 'items', 'items (5).png'),
      assetImg('characters', 'items', 'items (6).png'),
      assetImg('characters', 'items', 'items (7).png'),
      assetImg('characters', 'items', 'items (8).png'),
    ] as const,
  },

  /** 농장·미니게임·이펙트·콘페티·지도 */
  games: {
    root: `${ASSETS_IMG_BASE}/games`,
    farm: `${ASSETS_IMG_BASE}/games/farm`,
    minigames: `${ASSETS_IMG_BASE}/games/minigames`,
    effects: `${ASSETS_IMG_BASE}/games/effects`,
    confetti: `${ASSETS_IMG_BASE}/games/confetti`,
    map: `${ASSETS_IMG_BASE}/games/map`,
  },

  /** 상점·저금통·보상 */
  items: {
    root: `${ASSETS_IMG_BASE}/items`,
    shop: `${ASSETS_IMG_BASE}/items/shop`,
    /** 마켓 기본 일러스트 PNG 모음 (`marketItemImages.ts` 와 동일 폴더) */
    shopItems: `${ASSETS_IMG_BASE}/items/shop/items`,
    piggyBank: `${ASSETS_IMG_BASE}/items/piggy-bank`,
    rewards: `${ASSETS_IMG_BASE}/items/rewards`,
  },

  /** 배경·배너·미션 카드 프레임 */
  layouts: {
    root: `${ASSETS_IMG_BASE}/layouts`,
    backgrounds: `${ASSETS_IMG_BASE}/layouts/backgrounds`,
    banners: `${ASSETS_IMG_BASE}/layouts/banners`,
    missionCards: `${ASSETS_IMG_BASE}/layouts/mission-cards`,
    /** 자녀 홈: 캐릭터 뒤 전체 풍경(잔디 섬 PNG 대신 이 한 장을 깔 때 사용) */
    childHomeBackground01: assetImg('layouts', 'backgrounds', 'home_background_01.png'),
    /**
     * 공용 로딩(`loading.tsx`), 루트(`/`) 리다이렉트, 자녀 「미션」 탭 전체 배경을 **같은 PNG**로 맞출 때 이 경로만 바꾸면 됩니다.
     * (현재 파일: `public/assets/img/layouts/backgrounds/background_01.png`)
     */
    sharedAppBackground: assetImg('layouts', 'backgrounds', 'background_01.png'),
  },
} as const

export type AssetsCategory = keyof typeof ASSETS
