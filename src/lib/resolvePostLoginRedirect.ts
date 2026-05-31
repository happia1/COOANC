import type { SupabaseClient, User } from '@supabase/supabase-js'
import { parentEnterChildUiHref } from '@/lib/parentEnterChildUi'

/** 로그인·자동 로그인 후 서버가 판단하는 이동 계획입니다 */
export type PostLoginRedirectPlan =
  | { authenticated: false }
  | { authenticated: true; role: 'child'; redirectTo: '/home' }
  | {
      authenticated: true
      role: 'parent'
      kind: 'onboarding'
      redirectTo: '/onboarding'
    }
  | {
      authenticated: true
      role: 'parent'
      kind: 'single_child'
      redirectTo: string
      childId: string
    }
  | {
      authenticated: true
      role: 'parent'
      kind: 'multi_child'
      redirectTo: '/parent/home'
      childIds: string[]
    }

/**
 * 세션이 있을 때 역할·연결 자녀 수에 따라 다음 화면을 정합니다.
 * 미들웨어·루트 페이지·자동 로그인 API 가 같은 규칙을 씁니다.
 */
export async function resolvePostLoginRedirectForUser(
  supabase: SupabaseClient,
  user: User | null | undefined,
): Promise<PostLoginRedirectPlan> {
  if (!user) {
    return { authenticated: false }
  }

  const role = user.user_metadata?.role as string | undefined

  if (role === 'child') {
    return { authenticated: true, role: 'child', redirectTo: '/home' }
  }

  const { data: links, error } = await supabase
    .from('family_links')
    .select('child_id')
    .eq('parent_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[resolvePostLoginRedirect] family_links:', error.message)
    return {
      authenticated: true,
      role: 'parent',
      kind: 'multi_child',
      redirectTo: '/parent/home',
      childIds: [],
    }
  }

  const childIds = (links ?? []).map((row) => row.child_id).filter(Boolean) as string[]

  if (childIds.length === 0) {
    return { authenticated: true, role: 'parent', kind: 'onboarding', redirectTo: '/onboarding' }
  }

  if (childIds.length === 1) {
    const childId = childIds[0]!
    return {
      authenticated: true,
      role: 'parent',
      kind: 'single_child',
      redirectTo: parentEnterChildUiHref(childId),
      childId,
    }
  }

  return {
    authenticated: true,
    role: 'parent',
    kind: 'multi_child',
    redirectTo: '/parent/home',
    childIds,
  }
}
