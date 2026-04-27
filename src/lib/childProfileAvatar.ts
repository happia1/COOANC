/**
 * 자녀 프로필 사진(캐릭터 얼굴) 경로를 한곳에서 관리합니다.
 *
 * - 실제 이미지 파일: `public/assets/img/characters/base` 아래 `*_profile.png` (선택 UI 는 4종, 곰·여우 URL 은 구계정 호환용으로만 검증 통과)
 * - 앱·브라우저에서는 `public` 이 루트가 되므로 URL 은 `/assets/img/characters/base/...` 형태입니다.
 * - DB `profiles.avatar_url` 에는 위 공개 URL 문자열만 넣고, API 에서 허용 목록과 일치하는지 검사해
 *   임의의 외부 주소가 저장되지 않도록 합니다.
 */

/** 브라우저에서 접근하는 기본 경로 (public 기준) */
export const CHILD_PROFILE_CHARACTER_IMAGE_DIR = '/assets/img/characters/base' as const

/**
 * 프로필에서 **고를 수 있는** 캐릭터(4종). 곰·여우는 UI 에서 숨깁니다.
 * (서버 `isAllowedChildProfileAvatarUrl` 은 아래 `LEGACY_*` 까지 포함해 기존 저장값을 허용합니다.)
 */
export const CHILD_PROFILE_AVATAR_FILENAMES = [
  'bunny_profile.png',
  'chick_profile.png',
  'hamster_profile.png',
  'otter_profile.png',
] as const

/** 예전에 노출됐으나 제거 — DB 에 남은 주소는 계속 유효로 둡니다. */
export const LEGACY_CHILD_PROFILE_AVATAR_FILENAMES = ['bear_profile.png', 'fox_profile.png'] as const

export type ChildProfileAvatarFilename =
  | (typeof CHILD_PROFILE_AVATAR_FILENAMES)[number]
  | (typeof LEGACY_CHILD_PROFILE_AVATAR_FILENAMES)[number]

/** 허용된 전체 URL 집합 — API 검증용(선택 4종 + 구버전 2종) */
const ALLOWED_AVATAR_URLS = new Set<string>(
  ([...CHILD_PROFILE_AVATAR_FILENAMES, ...LEGACY_CHILD_PROFILE_AVATAR_FILENAMES] as const).map(
    (f) => `${CHILD_PROFILE_CHARACTER_IMAGE_DIR}/${f}`,
  ),
)

/** 파일 이름 → 브라우저용 URL */
export function publicUrlForChildProfileAvatar(file: ChildProfileAvatarFilename): string {
  return `${CHILD_PROFILE_CHARACTER_IMAGE_DIR}/${file}`
}

/**
 * 클라이언트가 보낸 avatar URL 이 우리가 배포한 캐릭터 프로필 이미지인지 확인합니다.
 * (허용되지 않은 값이면 DB 에 쓰지 않습니다.)
 */
export function isAllowedChildProfileAvatarUrl(url: string | null | undefined): boolean {
  if (url == null || typeof url !== 'string') return false
  return ALLOWED_AVATAR_URLS.has(url.trim())
}

/** 선택 UI — 병아리, 토끼, 수달, 햄스터 만 */
export const CHILD_PROFILE_AVATAR_OPTIONS: ReadonlyArray<{ url: string; label: string }> = [
  { url: publicUrlForChildProfileAvatar('chick_profile.png'), label: '병아리' },
  { url: publicUrlForChildProfileAvatar('bunny_profile.png'), label: '토끼' },
  { url: publicUrlForChildProfileAvatar('otter_profile.png'), label: '수달' },
  { url: publicUrlForChildProfileAvatar('hamster_profile.png'), label: '햄스터' },
]

/**
 * 온보딩 폼 하단 한 줄 — 위와 동일 4종 순서
 */
export const CHILD_PROFILE_AVATAR_OPTIONS_ONBOARDING_ROW: ReadonlyArray<{ url: string; label: string }> = [
  { url: publicUrlForChildProfileAvatar('chick_profile.png'), label: '병아리' },
  { url: publicUrlForChildProfileAvatar('bunny_profile.png'), label: '토끼' },
  { url: publicUrlForChildProfileAvatar('otter_profile.png'), label: '수달' },
  { url: publicUrlForChildProfileAvatar('hamster_profile.png'), label: '햄스터' },
]
