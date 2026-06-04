/** 세션 확인 중 — 아직 자녀/부모 중 어디로 갈지 모를 때 */
export const AUTO_LOGIN_CHECKING_MESSAGE = '자녀·부모 앱으로 이동하는 중…'

export type AutoLoginTransitionPresentation = {
  message: string
  background: 'child' | 'parent'
}

/** 로그인 후 실제 이동 URL 기준으로 전환 화면 문구·배경을 고릅니다. */
export function getTransitionForAutoLoginTarget(target: string): AutoLoginTransitionPresentation {
  if (target === '/home' || target.startsWith('/api/parent/enter-child-ui')) {
    return { message: '자녀 앱으로 이동하는 중…', background: 'child' }
  }
  return { message: '부모 앱으로 이동하는 중…', background: 'parent' }
}
