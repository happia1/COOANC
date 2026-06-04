/** 브라우저에 저장하는 「자동 로그인하기」 체크 상태 키 */
export const AUTO_LOGIN_STORAGE_KEY = 'cooanc:auto-login-enabled'

/** localStorage 에서 자동 로그인 사용 여부를 읽습니다(기본값: 켜짐). */
export function readAutoLoginEnabled(): boolean {
  if (typeof window === 'undefined') return true
  const saved = window.localStorage.getItem(AUTO_LOGIN_STORAGE_KEY)
  if (saved === null) return true
  return saved === 'true'
}

export function writeAutoLoginEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(AUTO_LOGIN_STORAGE_KEY, String(enabled))
}
