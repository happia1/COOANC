import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { isRetriableMissingColumnError } from '@/lib/supabase/childProfileSelect'

/**
 * 자녀 앱 RSC 트리에서 `getActorChildContext`·레이아웃·각 탭 페이지가
 * 같은 `profiles` / `family_links` 행을 반복 조회하지 않도록 React `cache` 로 묶습니다.
 * (클라이언트 Context 와 별개로, 서버 한 요청 안에서의 중복만 제거합니다.)
 */

export type CachedChildProfileRow = {
  name: string | null
  role: string | null
  avatar_url?: string | null
}

/**
 * `profiles` 한 줄 — `avatar_url` 없는 구형 DB 는 name·role 만 재시도합니다.
 */
export const getCachedProfileRowById = cache(async (id: string): Promise<CachedChildProfileRow | null> => {
  const supabase = await createClient()
  const res = await supabase.from('profiles').select('name, role, avatar_url').eq('id', id).maybeSingle()
  if (res.data) return res.data as CachedChildProfileRow
  if (res.error && isRetriableMissingColumnError(res.error)) {
    const fb = await supabase.from('profiles').select('name, role').eq('id', id).maybeSingle()
    return (fb.data as CachedChildProfileRow | null) ?? null
  }
  return null
})

export type CachedFamilyLinkRow = { id: string; parent_id: string }

/**
 * 이 자녀에 연결된 `family_links` 전부 (마켓·미션이 같은 행을 씁니다).
 */
export const getCachedFamilyLinksForChild = cache(async (childId: string): Promise<CachedFamilyLinkRow[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase.from('family_links').select('id, parent_id').eq('child_id', childId)
  if (error) {
    console.error('[childAppDataCache] family_links', error.message)
    return []
  }
  return (data ?? []) as CachedFamilyLinkRow[]
})
