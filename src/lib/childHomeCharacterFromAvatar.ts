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
} from '@/constants/sprites'
import { publicUrlForChildProfileAvatar, isAllowedChildProfileAvatarUrl } from '@/lib/childProfileAvatar'

/** 홈 섬(`scene="bunny"`)에 올릴 스프라이트 한 장 — 캐릭터 종류마다 frame 타입이 다릅니다 */
export type HomeIslandStageSprite =
  | { character: 'bears'; frame: BearFrameName; width: number; height: number }
  | { character: 'bunny'; frame: BunnyFrameName; width: number; height: number }
  | { character: 'chicks'; frame: ChicksFrameName; width: number; height: number }
  | { character: 'fox'; frame: FoxFrameName; width: number; height: number }
  | { character: 'hamster'; frame: HamsterFrameName; width: number; height: number }

const DEFAULT_STAGE: HomeIslandStageSprite = {
  character: 'bunny',
  frame: '레이어 19',
  width: 108,
  height: 238,
}

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

/** 프로필 URL → 홈 무대용 스프라이트(정면 프레임) */
const STAGE_BY_AVATAR_URL: Record<string, HomeIslandStageSprite> = {
  [publicUrlForChildProfileAvatar('fox_profile.png')]: {
    character: 'fox',
    frame: 'fox(2)',
    width: 112,
    height: 238,
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
    width: 108,
    height: 238,
  },
  [publicUrlForChildProfileAvatar('chick_profile.png')]: {
    character: 'chicks',
    frame: 'chics (3)',
    width: 118,
    height: 228,
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
