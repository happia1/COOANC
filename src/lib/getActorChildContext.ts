import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { normalizeUuidParam } from '@/lib/normalizeUuid'
import { PARENT_AS_CHILD_COOKIE } from '@/lib/parentAsChildCookie'

/**
 * 자녀 앱 라우트 그룹 `(child)` 안에서 「누구 기준」으로 데이터를 볼지 정합니다.
 * - 자녀로 로그인: 항상 본인 id
 * - 부모로 로그인: 쿠키에 저장된 연결 자녀 id (없거나 위조면 부모 홈으로 보냄)
 *
 * React `cache` 로 같은 요청 안에서 layout·페이지가 한 번만 조회하도록 합니다.
 */
export type ActorChildContext = {
  /** 미션·통계 등에 쓰는 자녀 profiles.id */
  actorChildId: string
  /** true 이면 세션은 부모이지만 자녀 화면을 미리보는 중 */
  isParentPreview: boolean
  /** Supabase Auth 사용자 id (부모 또는 자녀 본인) */
  sessionUserId: string
}

export const getActorChildContext = cache(async (): Promise<ActorChildContext> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = profile?.role ?? null

  if (role === 'parent') {
    const jar = await cookies()
    const raw = jar.get(PARENT_AS_CHILD_COOKIE)?.value ?? ''
    const childId = normalizeUuidParam(raw)
    if (!childId) {
      redirect('/parent/home')
    }

    const { data: link } = await supabase
      .from('family_links')
      .select('id')
      .eq('parent_id', user.id)
      .eq('child_id', childId)
      .maybeSingle()

    if (!link) {
      redirect('/parent/home')
    }

    return { actorChildId: childId, isParentPreview: true, sessionUserId: user.id }
  }

  return { actorChildId: user.id, isParentPreview: false, sessionUserId: user.id }
})
