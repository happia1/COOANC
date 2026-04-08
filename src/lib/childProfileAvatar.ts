/**
 * 자녀 프로필 사진(캐릭터 얼굴) 경로를 한곳에서 관리합니다.
 *
 * - 실제 이미지 파일: `public/assets/img/characters/base` 아래, 파일 이름에 `_profile` 이 들어간 PNG
 * - 앱·브라우저에서는 `public` 이 루트가 되므로 URL 은 `/assets/img/characters/base/...` 형태입니다.
 * - DB `profiles.avatar_url` 에는 위 공개 URL 문자열만 넣고, API 에서 허용 목록과 일치하는지 검사해
 *   임의의 외부 주소가 저장되지 않도록 합니다.
 */

/** 브라우저에서 접근하는 기본 경로 (public 기준) */
export const CHILD_PROFILE_CHARACTER_IMAGE_DIR = '/assets/img/characters/base' as const

/**
 * `_profile` 규칙을 만족하는 파일 이름 목록
 * (폴더에 파일을 더 넣으면 여기에 한 줄 추가하면 선택 UI·서버 검증이 같이 따라갑니다)
 */
export const CHILD_PROFILE_AVATAR_FILENAMES = [
  'bear_profile.png',
  'bunny_profile.png',
  'chick_profile.png',
  'fox_profile.png',
  'hamster_profile.png',
] as const

export type ChildProfileAvatarFilename = (typeof CHILD_PROFILE_AVATAR_FILENAMES)[number]

/** 허용된 전체 URL 집합 — API 검증용 */
const ALLOWED_AVATAR_URLS = new Set<string>(
  CHILD_PROFILE_AVATAR_FILENAMES.map((f) => `${CHILD_PROFILE_CHARACTER_IMAGE_DIR}/${f}`),
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

/** 선택 UI 에 쓰는 옵션 — 짧은 한글 이름은 아이·부모가 고를 때 구분하기 쉽게 붙였습니다 */
export const CHILD_PROFILE_AVATAR_OPTIONS: ReadonlyArray<{ url: string; label: string }> = [
  { url: publicUrlForChildProfileAvatar('bear_profile.png'), label: '곰' },
  { url: publicUrlForChildProfileAvatar('bunny_profile.png'), label: '토끼' },
  { url: publicUrlForChildProfileAvatar('chick_profile.png'), label: '병아리' },
  { url: publicUrlForChildProfileAvatar('fox_profile.png'), label: '여우' },
  { url: publicUrlForChildProfileAvatar('hamster_profile.png'), label: '햄스터' },
]

/**
 * 온보딩 폼 하단 한 줄 나열 순서 (요청: fox → bunny → bear → hamster → chick)
 * — 이 순서대로 프로필 PNG 를 고르면 홈 섬 정면 캐릭터가 같은 종으로 맞춰집니다.
 */
export const CHILD_PROFILE_AVATAR_OPTIONS_ONBOARDING_ROW: ReadonlyArray<{ url: string; label: string }> = [
  { url: publicUrlForChildProfileAvatar('fox_profile.png'), label: '여우' },
  { url: publicUrlForChildProfileAvatar('bunny_profile.png'), label: '토끼' },
  { url: publicUrlForChildProfileAvatar('bear_profile.png'), label: '곰' },
  { url: publicUrlForChildProfileAvatar('hamster_profile.png'), label: '햄스터' },
  { url: publicUrlForChildProfileAvatar('chick_profile.png'), label: '병아리' },
]
