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
     * 홈 「내 캐릭터 꾸미기」용 아이템 PNG 목록입니다.
     * - 실제 파일은 `public/assets/img/characters/items/` 에 있으며, 괄호 안 숫자가 작은 것부터 큰 순으로 정렬해 두었습니다.
     * - (2)~(8) 번 파일은 현재 폴더에 없으므로 목록에서 빠져 있습니다.
     * - 파일명에 공백이 있어도 Next/Image 가 그대로 요청할 수 있습니다.
     * - legacyIndex: DB의 item_index 값(0-based)과 일치합니다.
     */
    decorItemImages: [
      assetImg('characters', 'items', 'items (1).png'),
      assetImg('characters', 'items', 'items (9).png'),
      assetImg('characters', 'items', 'items (10).png'),
      assetImg('characters', 'items', 'items (11).png'),
      assetImg('characters', 'items', 'items (12).png'),
      assetImg('characters', 'items', 'items (13).png'),
      assetImg('characters', 'items', 'items (14).png'),
      assetImg('characters', 'items', 'items (15).png'),
      assetImg('characters', 'items', 'items (16).png'),
      assetImg('characters', 'items', 'items (17).png'),
      assetImg('characters', 'items', 'items (18).png'),
      assetImg('characters', 'items', 'items (19).png'),
      assetImg('characters', 'items', 'items (20).png'),
      assetImg('characters', 'items', 'items (21).png'),
      assetImg('characters', 'items', 'items (22).png'),
      assetImg('characters', 'items', 'items (23).png'),
      assetImg('characters', 'items', 'items (24).png'),
      assetImg('characters', 'items', 'items (25).png'),
      assetImg('characters', 'items', 'items (26).png'),
      assetImg('characters', 'items', 'items (27).png'),
      assetImg('characters', 'items', 'items (28).png'),
      assetImg('characters', 'items', 'items (29).png'),
      assetImg('characters', 'items', 'items (30).png'),
      assetImg('characters', 'items', 'items (31).png'),
      assetImg('characters', 'items', 'items (32).png'),
      assetImg('characters', 'items', 'items (33).png'),
      assetImg('characters', 'items', 'items (34).png'),
      assetImg('characters', 'items', 'items (35).png'),
      assetImg('characters', 'items', 'items (36).png'),
      assetImg('characters', 'items', 'items (37).png'),
    ] as const,

    /**
     * 꾸미기 아이템을 카테고리(옷·악세서리·배경)별로 분류한 목록입니다.
     * - 각 폴더(cloth / acc / background)에 실제 파일이 있는 이미지만 포함합니다.
     * - legacyIndex: 위 decorItemImages 배열의 0-based 인덱스 → DB item_index 와 동일합니다.
     *   (잠금 해제 여부를 확인할 때 이 값으로 unlockedIndexes 를 조회합니다.)
     *
     * 비개발자 설명:
     * - 옷(cloth): 캐릭터가 입는 의상 아이템
     * - 악세서리(acc): 모자·안경 등 꾸밈 소품
     * - 배경(background): 캐릭터 뒤에 깔리는 배경 이미지
     */
    decorItemsByCategory: {
      cloth: [
        { src: assetImg('characters', 'items', 'cloth', 'items (18).png'), legacyIndex: 10 },
        { src: assetImg('characters', 'items', 'cloth', 'items (19).png'), legacyIndex: 11 },
        { src: assetImg('characters', 'items', 'cloth', 'items (23).png'), legacyIndex: 15 },
        { src: assetImg('characters', 'items', 'cloth', 'items (35).png'), legacyIndex: 27 },
        { src: assetImg('characters', 'items', 'cloth', 'items (37).png'), legacyIndex: 29 },
      ],
      acc: [
        { src: assetImg('characters', 'items', 'acc', 'items (1).png'),  legacyIndex: 0  },
        { src: assetImg('characters', 'items', 'acc', 'items (9).png'),  legacyIndex: 1  },
        { src: assetImg('characters', 'items', 'acc', 'items (10).png'), legacyIndex: 2  },
        { src: assetImg('characters', 'items', 'acc', 'items (12).png'), legacyIndex: 4  },
        { src: assetImg('characters', 'items', 'acc', 'items (13).png'), legacyIndex: 5  },
        { src: assetImg('characters', 'items', 'acc', 'items (14).png'), legacyIndex: 6  },
        { src: assetImg('characters', 'items', 'acc', 'items (17).png'), legacyIndex: 9  },
        { src: assetImg('characters', 'items', 'acc', 'items (22).png'), legacyIndex: 14 },
        { src: assetImg('characters', 'items', 'acc', 'items (24).png'), legacyIndex: 16 },
      ],
      background: [
        { src: assetImg('characters', 'items', 'background', 'items (20).png'), legacyIndex: 12 },
        { src: assetImg('characters', 'items', 'background', 'items (21).png'), legacyIndex: 13 },
        { src: assetImg('characters', 'items', 'background', 'items (25).png'), legacyIndex: 17 },
        { src: assetImg('characters', 'items', 'background', 'items (26).png'), legacyIndex: 18 },
        { src: assetImg('characters', 'items', 'background', 'items (27).png'), legacyIndex: 19 },
        { src: assetImg('characters', 'items', 'background', 'items (28).png'), legacyIndex: 20 },
        { src: assetImg('characters', 'items', 'background', 'items (29).png'), legacyIndex: 21 },
        { src: assetImg('characters', 'items', 'background', 'items (30).png'), legacyIndex: 22 },
        { src: assetImg('characters', 'items', 'background', 'items (31).png'), legacyIndex: 23 },
        { src: assetImg('characters', 'items', 'background', 'items (32).png'), legacyIndex: 24 },
        { src: assetImg('characters', 'items', 'background', 'items (33).png'), legacyIndex: 25 },
        { src: assetImg('characters', 'items', 'background', 'items (34).png'), legacyIndex: 26 },
        { src: assetImg('characters', 'items', 'background', 'items (36).png'), legacyIndex: 28 },
      ],
    },
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
    /**
     * 자녀 홈 기본 배경(레거시 호환 키) — 실제 PNG 는 `childHomeBackgroundSecondScreen` 와 동일 파일을 가리킵니다.
     */
    childHomeBackground01: assetImg('layouts', 'backgrounds', 'tablet_kidsroom_background_portrait2.png'),
    /**
     * 자녀 앱 홈 탭 풀블리드 배경입니다.
     * - 키즈룸 일러스트, 세로(portrait) (`tablet_kidsroom_background_portrait2.png`).
     * - 미션·로딩 등 다른 화면의 `sharedAppBackground` 와는 별도 파일이라 교체 시 홈만 바뀝니다.
     */
    childHomeBackgroundSecondScreen: assetImg(
      'layouts',
      'backgrounds',
      'tablet_kidsroom_background_portrait2.png',
    ),
    /**
     * 공용 로딩(`loading.tsx`), 루트(`/`) 리다이렉트 등 — 미션 탭은 전면 배경 이미지를 쓰지 않습니다.
     * `background_01.png` 는 저장소에 없어 404가 나므로, 동일 용도로 있는 첫 화면 배경 PNG 를 사용합니다.
     */
    sharedAppBackground: assetImg('layouts', 'backgrounds', 'first_screen_background.png'),
  },
} as const

/**
 * 자녀 홈 풀블리드 배경(`/assets/.../tablet_kidsroom_background_portrait.png`)의 캐시를 끊는 버전 번호입니다.
 *
 * 비개발자 설명:
 * - Vercel 설정으로 `public` 안의 `/assets/**` 파일은 브라우저에 「1년 동안 이 주소는 안 바뀐다」라고 알려 줍니다(immutable).
 * - 같은 파일명으로 그림만 갈아끼우면, 또는 `next/image` 최적화(WebP) 캐시가 남으면 예전 그림이 계속 보일 수 있습니다.
 * - 그림을 바꿨는데도 홈 배경이 안 바뀌면 이 숫자만 1 올리면, 주소가 `...png?v=2` 처럼 달라져서 새 파일을 받아옵니다.
 * - `HomeTab` 배경 `<img>` 에만 붙입니다.
 */
export const CHILD_HOME_BACKGROUND_CACHE_BUST = '4'

export type AssetsCategory = keyof typeof ASSETS

/**
 * 꾸미기 아이템을 화면에서 전부 잠금처럼 보이게 할 때 true 로 둡니다.
 * - true: DB 에 잠금 해제가 있어도 칸은 잠금 UI만 보이고, 실시간으로 새로 풀려도 축하 팝업은 띄우지 않습니다.
 * - 조건(미션·저장 등)을 `triggerItemMap` 과 연동한 뒤 false 로 바꾸면 정상적으로 해제 상태가 반영됩니다.
 */
/**
 * 운영 기본값은 false 입니다.
 * - 비개발자용 설명: true 로 두면 "모든 아이템이 잠긴 것처럼" 보여서 회색 자물쇠만 보입니다.
 */
export const CHARACTER_DECOR_UI_FORCE_ALL_LOCKED = false
