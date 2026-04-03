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
    piggyBank: `${ASSETS_IMG_BASE}/items/piggy-bank`,
    rewards: `${ASSETS_IMG_BASE}/items/rewards`,
  },

  /** 배경·배너·미션 카드 프레임 */
  layouts: {
    root: `${ASSETS_IMG_BASE}/layouts`,
    backgrounds: `${ASSETS_IMG_BASE}/layouts/backgrounds`,
    banners: `${ASSETS_IMG_BASE}/layouts/banners`,
    missionCards: `${ASSETS_IMG_BASE}/layouts/mission-cards`,
  },
} as const

export type AssetsCategory = keyof typeof ASSETS
