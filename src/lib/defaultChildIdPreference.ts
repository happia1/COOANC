/**
 * 다자녀 가정에서 로그인 직후 「어느 아이 화면으로 먼저 갈지」를 기억합니다.
 *
 * 비개발자 설명:
 * - 값은 **자녀 한 명의 고유 번호(UUID)** 가 문자열로 들어갑니다.
 * - 브라우저 **localStorage** 에만 저장되며, 서버(클라우드 DB)로는 보내지 않습니다.
 * - 자녀가 한 명뿐이면 앱이 알아서 그 아이 화면으로 바로 가므로, 이 설정은 보통 **둘 이상**일 때만 씁니다.
 */
import { normalizeUuidParam } from '@/lib/normalizeUuid'

/** 요구사항에서 정한 저장 키 — 다른 코드와 반드시 동일해야 합니다. */
export const DEFAULT_CHILD_ID_STORAGE_KEY = 'defaultChildId' as const

/**
 * localStorage 에서 저장된 UUID 를 읽고, 형식이 깨졌으면 null 로 돌려줍니다.
 * (서버 렌더링 중에는 `window` 가 없으므로 항상 null 입니다.)
 */
export function getStoredDefaultChildId(): string | null {
  if (typeof window === 'undefined') return null
  return normalizeUuidParam(window.localStorage.getItem(DEFAULT_CHILD_ID_STORAGE_KEY))
}

/**
 * 시작 화면 자녀를 고릅니다.
 * - 올바른 UUID 를 넘기면 저장합니다.
 * - null/빈 값이면 항목을 지워서 「부모 홈에서 시작」과 같이 동작하게 합니다.
 */
export function setStoredDefaultChildId(childId: string | null | undefined): void {
  if (typeof window === 'undefined') return
  const n = normalizeUuidParam(childId)
  if (n) {
    window.localStorage.setItem(DEFAULT_CHILD_ID_STORAGE_KEY, n)
  } else {
    window.localStorage.removeItem(DEFAULT_CHILD_ID_STORAGE_KEY)
  }
}

/**
 * 자녀 프로필을 삭제했을 때 호출합니다.
 * 삭제한 아이가 「시작 화면」으로 지정돼 있었다면 저장값을 함께 지웁니다.
 */
export function clearStoredDefaultChildIdIfMatches(childId: string): void {
  if (typeof window === 'undefined') return
  const cur = window.localStorage.getItem(DEFAULT_CHILD_ID_STORAGE_KEY)
  if (cur === childId) {
    window.localStorage.removeItem(DEFAULT_CHILD_ID_STORAGE_KEY)
  }
}
