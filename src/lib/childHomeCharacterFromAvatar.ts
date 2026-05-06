/**
 * 자녀 `profiles.avatar_url`(프로필용 *_profile.png 경로)을
 * 홈 섬 무대의 `CharacterSprite`(정면에 가까운 스프라이트 프레임)로 바꿉니다.
 *
 * - 각 아틀라스에서 「정면」에 가깝다고 보이는 프레임을 골랐습니다.
 * - URL 이 없거나 허용 목록에 없으면 예전과 같이 토끼 정면을 씁니다.
 */

import {
  BEARS,
  BEAR_HOME_ISLAND_FRONT_FRAME,
  type BearFrameName,
  type BunnyFrameName,
  type ChicksFrameName,
  type FoxFrameName,
  type HamsterFrameName,
  type OtterFrameName,
} from '@/constants/sprites'
import { publicUrlForChildProfileAvatar, isAllowedChildProfileAvatarUrl } from '@/lib/childProfileAvatar'

/** 홈 섬(`scene="bunny"`)에 올릴 스프라이트 한 장 — 캐릭터 종류마다 frame 타입이 다릅니다 */
export type HomeIslandStageSprite =
  | { character: 'bears'; frame: BearFrameName; width: number; height: number }
  | { character: 'bunny'; frame: BunnyFrameName; width: number; height: number }
  | { character: 'chicks'; frame: ChicksFrameName; width: number; height: number }
  | { character: 'fox'; frame: FoxFrameName; width: number; height: number }
  | { character: 'hamster'; frame: HamsterFrameName; width: number; height: number }
  | { character: 'otter'; frame: OtterFrameName; width: number; height: number }

const DEFAULT_STAGE: HomeIslandStageSprite = {
  character: 'bunny',
  frame: '레이어 19',
  width: 108,
  height: 238,
}

/**
 * 홈 화면(자녀 방 배경)에서 토끼만 살짝 더 크게 보이게 할 때 쓰는 배율입니다.
 * 비개발자 설명: 1이면 기존과 같습니다.
 */
export const BUNNY_HOME_DISPLAY_SCALE = 0.85

/**
 * 자녀 앱(ChildScreen)에서 수달(`otter`) 캐릭터는 토끼와 같은 배율로 맞춥니다.
 * 비개발자 설명: 전체 화면에서도 수달 키가 토끼와 비슷하게 보이게 합니다.
 */
export const OTTER_HOME_DISPLAY_SCALE = BUNNY_HOME_DISPLAY_SCALE

/**
 * 곰 홈 캐릭터는 토끼 높이에 맞추지 않고, `bears.png`의 bear1(Bears (1)) 프레임 자체를 기준으로 계산합니다.
 * - rotated 프레임은 시각상 가로/세로가 뒤집히므로 natural width/height 를 보정합니다.
 * - 스케일은 곰 전용 상수로만 제어합니다.
 */
const BEAR1_FRAME = BEARS.frames[BEAR_HOME_ISLAND_FRONT_FRAME]
const BEAR1_NATURAL_WIDTH = BEAR1_FRAME.rotated ? BEAR1_FRAME.h : BEAR1_FRAME.w
const BEAR1_NATURAL_HEIGHT = BEAR1_FRAME.rotated ? BEAR1_FRAME.w : BEAR1_FRAME.h
// 곰이 홈 섬에서 과하게 커 보이지 않도록 스케일을 한 단계 줄입니다.
const BEAR_HOME_ISLAND_SCALE = 0.42
const BEAR_HOME_ISLAND_WIDTH = Math.round(BEAR1_NATURAL_WIDTH * BEAR_HOME_ISLAND_SCALE)
const BEAR_HOME_ISLAND_HEIGHT = Math.round(BEAR1_NATURAL_HEIGHT * BEAR_HOME_ISLAND_SCALE)

/**
 * 햄스터·병아리는 토끼·여우보다 작게 둡니다(작은 펫 전용).
 * 각각 `HAMSTER_*`, `CHICK_*` 상수로 가로·세로를 따로 둡니다.
 */

/**
 * 햄스터 홈 무대 가로: 예전 기본(66px)보다 넓혀 옆으로 더 시원하게 보이게 합니다.
 */
const HAMSTER_HOME_STAGE_WIDTH = 88

/**
 * 햄스터 홈 무대 세로(키): 병아리보다 키를 더 주어 무대에서 덩치가 나오게 합니다.
 */
const HAMSTER_HOME_STAGE_HEIGHT = 170

/**
 * 병아리 홈 무대 가로·세로: 전체 크기를 조금 키워 작은 펫이어도 잘 보이게 합니다.
 */
const CHICK_HOME_STAGE_WIDTH = 98
const CHICK_HOME_STAGE_HEIGHT = 152

/**
 * 홈 섬 `chics (1)` 스프라이트 — 아틀라스에서 왼쪽에 이웃 타일이 살짝 보이면 `ChildScreen`의 `clip-path`로 잘라냅니다(프로필 PNG/선택 UI는 건드리지 않음).
 * (필요 시 px만 올리면 됨)
 */
export const CHICK_HOME_ISLAND_CLIP_LEFT_PX = 8

/**
 * 수달 홈 무대 가로·세로:
 * - 수달 시트 비율을 유지하기 위해 가로는 기존 폭을 유지합니다.
 */
const OTTER_HOME_STAGE_WIDTH = 132
const OTTER_HOME_STAGE_HEIGHT = 238

/** 프로필 URL → 홈 무대용 스프라이트(정면 프레임) */
const STAGE_BY_AVATAR_URL: Record<string, HomeIslandStageSprite> = {
  [publicUrlForChildProfileAvatar('fox_profile.png')]: {
    character: 'fox',
    frame: 'fox(2)',
    /**
     * 홈 화면 무대: 여우만 가로를 살짝 넓히고, 세로는 토끼 기본(238)보다 조금 짧게 두어
     * 덩치가 한 단계 작아 보이게 합니다(픽셀 박스 크기 = 화면에 그려지는 크기).
     */
    width: 118,
    height: 200,
  },
  [publicUrlForChildProfileAvatar('bunny_profile.png')]: {
    character: 'bunny',
    frame: '레이어 19',
    width: 108,
    height: 238,
  },
  /**
   * 곰: `bears.png`의 bear1(`Bears (1)`)을 홈 대표 캐릭터로 사용합니다.
   * 표시 크기는 곰 프레임 자연 크기 × `BEAR_HOME_ISLAND_SCALE`로 계산합니다.
   */
  [publicUrlForChildProfileAvatar('bear_profile.png')]: {
    character: 'bears',
    frame: BEAR_HOME_ISLAND_FRONT_FRAME,
    width: BEAR_HOME_ISLAND_WIDTH,
    height: BEAR_HOME_ISLAND_HEIGHT,
  },
  [publicUrlForChildProfileAvatar('hamster_profile.png')]: {
    character: 'hamster',
    frame: 'hams (1)',
    width: HAMSTER_HOME_STAGE_WIDTH,
    height: HAMSTER_HOME_STAGE_HEIGHT,
  },
  /**
   * 병아리: 시트에서 `(2)` 는 뒤·`(3)` 은 옆에 가깝고, 오른쪽 `(1)` 이 정면에 가깝습니다.
   * 표시 크기는 `CHICK_HOME_STAGE_WIDTH` × `CHICK_HOME_STAGE_HEIGHT` 로 무대에 올립니다.
   */
  [publicUrlForChildProfileAvatar('chick_profile.png')]: {
    character: 'chicks',
    frame: 'chics (1)',
    width: CHICK_HOME_STAGE_WIDTH,
    height: CHICK_HOME_STAGE_HEIGHT,
  },
  /**
   * 수달: `otter.png` 시트는 왼쪽→오른쪽이 (1)뒤·(3)옆·(2)정면 순입니다.
   * 예전에 (1)만 쓰면 등만 보이므로 정면은 `Otter (2)` 를 씁니다.
   */
  [publicUrlForChildProfileAvatar('otter_profile.png')]: {
    character: 'otter',
    frame: 'Otter (2)',
    width: OTTER_HOME_STAGE_WIDTH,
    height: OTTER_HOME_STAGE_HEIGHT,
  },
}

/**
 * DB 에 저장된 프로필 이미지 URL 로 홈 섬 캐릭터를 고릅니다.
 * @param avatarUrl `profiles.avatar_url` (또는 null)
 */
export function resolveHomeIslandStageSprite(avatarUrl: string | null | undefined): HomeIslandStageSprite {
  const t = typeof avatarUrl === 'string' ? avatarUrl.trim() : ''
  if (!t || !isAllowedChildProfileAvatarUrl(t)) return DEFAULT_STAGE
  return STAGE_BY_AVATAR_URL[t] ?? DEFAULT_STAGE
}
