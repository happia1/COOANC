import { parentEnterChildUiHref } from '@/lib/parentEnterChildUi'
import { getStoredDefaultChildId, setStoredDefaultChildId } from '@/lib/defaultChildIdPreference'
import type { PostLoginRedirectPlan } from '@/lib/resolvePostLoginRedirect'

/**
 * 서버가 내려준 로그인 후 계획 + 브라우저에 저장된 `defaultChildId` 로
 * 실제로 이동할 URL 하나를 고릅니다.
 */
export function pickPostLoginNavigationTarget(plan: PostLoginRedirectPlan): string | null {
  if (!plan.authenticated) return null

  if (plan.role === 'child') {
    return plan.redirectTo
  }

  if (plan.kind === 'onboarding' || plan.kind === 'single_child') {
    return plan.redirectTo
  }

  const preferred = getStoredDefaultChildId()
  if (preferred && plan.childIds.includes(preferred)) {
    return parentEnterChildUiHref(preferred)
  }

  if (preferred) {
    setStoredDefaultChildId(null)
  }

  return plan.redirectTo
}
