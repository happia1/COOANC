/** 브라우저에 저장하는 「자동 로그인하기」 체크 상태 키 */
export const AUTO_LOGIN_STORAGE_KEY = 'cooanc:auto-login-enabled'

/** localStorage 에서 자동 로그인 사용 여부를 읽습니다(기본값: 켜짐). */
export function readAutoLoginEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const saved = window.localStorage.getItem(AUTO_LOGIN_STORAGE_KEY)
    return saved === null || saved === 'true'
  } catch {
    return true
  }
}

export function writeAutoLoginEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(AUTO_LOGIN_STORAGE_KEY, String(enabled))
  } catch { /* 저장소 차단이 로그인을 막으면 안 됩니다. */ }
}

const REMEMBERED_LOGIN_ID_KEY = 'cooanc:remembered-login-id'

export function readRememberedLoginId(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(REMEMBERED_LOGIN_ID_KEY) ?? ''
  } catch { return '' }
}

/** 비밀번호는 저장하지 않으며, 체크 해제 시 기존 ID도 지웁니다. */
export function writeRememberedLoginId(email: string, remember: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (remember) window.localStorage.setItem(REMEMBERED_LOGIN_ID_KEY, email.trim())
    else window.localStorage.removeItem(REMEMBERED_LOGIN_ID_KEY)
  } catch { /* 저장소가 차단돼도 로그인은 계속합니다. */ }
}
