/**
 * 자녀 `profiles.avatar_url`(프로필용 *_profile.png 경로)을
 * 홈 섬 무대의 `CharacterSprite`(정면에 가까운 스프라이트 프레임)로 바꿉니다.
 *
 * - 각 아틀라스에서 「정면」에 가깝다고 보이는 프레임을 골랐습니다.
 * - URL 이 없거나 허용 목록에 없으면 예전과 같이 토끼 정면을 씁니다.
 */

import type { BearFrameName, BunnyFrameName, ChicksFrameName, FoxFrameName, HamsterFrameName } from '@/constants/sprites'
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
  [publicUrlForChildProfileAvatar('bear_profile.png')]: {
    character: 'bears',
    frame: 'Bears (2)',
    width: 100,
    height: 248,
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
