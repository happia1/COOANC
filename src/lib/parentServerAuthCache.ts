import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

/**
 * 부모 앱 `/parent/*` 에서 레이아웃과 각 `page.tsx` 가 각각
 * `profiles`·`family_links` 를 조회하면 같은 요청 안에서 2~3번 중복됩니다.
 * React `cache` 로 **한 번만** Supabase 를 치고 결과를 재사용합니다.
 *
 * (클라이언트 훅/SWR 과 달리, 서버 컴포넌트 트리에서는 이 패턴이 표준에 가깝습니다.)
 */
export type CachedParentAuthRow = {
  user: User
  /** DB 에 행이 없으면 null */
  profile: { id: string; name: string | null; role: string | null } | null
  /** role 이 parent 일 때만 채워짐 */
  familyLinks: { id: string; child_id: string }[]
}

export const getCachedParentAuth = cache(async (): Promise<CachedParentAuthRow | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    return { user, profile: null, familyLinks: [] }
  }

  if (profile.role !== 'parent') {
    return { user, profile, familyLinks: [] }
  }

  const { data: links } = await supabase
    .from('family_links')
    .select('id, child_id')
    .eq('parent_id', user.id)

  return {
    user,
    profile,
    familyLinks: (links ?? []).map((l) => ({ id: l.id, child_id: l.child_id })),
  }
})
