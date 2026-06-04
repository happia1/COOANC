import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { isRetriableMissingColumnError } from '@/lib/supabase/childProfileSelect'
import {
  SUPABASE_FETCH_RETRY_DELAYS_MS,
  delayMs,
  isTransientFetchErrorMessage,
} from '@/lib/supabase/transientFetchError'

/**
 * 자녀 앱 RSC 트리에서 `getActorChildContext`·레이아웃·각 탭 페이지가
 * 같은 `profiles` / `family_links` 행을 반복 조회하지 않도록 React `cache` 로 묶습니다.
 * (클라이언트 Context 와 별개로, 서버 한 요청 안에서의 중복만 제거합니다.)
 */

export type CachedChildProfileRow = {
  name: string | null
  role: string | null
  avatar_url?: string | null
  /**
   * 064 `profiles.holiday_routine_mode` — 주말 백필에서 daily 를 쓸지(`as_weekday`) weekly 만 쓸지(`custom`) 구분
   * 없으면(null) weekly 템플릿 수로만 추론(구버전 DB/미저장)
   */
  holiday_routine_mode?: 'as_weekday' | 'custom' | null
}

function logSupabaseCacheFailure(scope: string, message: string): void {
  const hint = isTransientFetchErrorMessage(message)
    ? ' Supabase URL·인터넷·프로젝트 상태를 확인하고 dev 서버를 재시작해 보세요.'
    : ''
  console.warn(`[childAppDataCache] ${scope}: ${message}.${hint}`)
}

/**
 * `profiles` 한 줄 — `avatar_url` 없는 구형 DB 는 name·role 만 재시도합니다.
 */
export const getCachedProfileRowById = cache(async (id: string): Promise<CachedChildProfileRow | null> => {
  for (let attempt = 0; attempt < SUPABASE_FETCH_RETRY_DELAYS_MS.length; attempt++) {
    await delayMs(SUPABASE_FETCH_RETRY_DELAYS_MS[attempt] ?? 0)
    const supabase = await createClient()
    const res = await supabase
      .from('profiles')
      .select('name, role, avatar_url, holiday_routine_mode')
      .eq('id', id)
      .maybeSingle()
    if (res.data) return res.data as CachedChildProfileRow
    if (res.error) {
      if (!isRetriableMissingColumnError(res.error)) {
        if (
          isTransientFetchErrorMessage(res.error.message) &&
          attempt < SUPABASE_FETCH_RETRY_DELAYS_MS.length - 1
        ) {
          continue
        }
        logSupabaseCacheFailure('profiles', res.error.message)
        return null
      }
      const fb = await supabase.from('profiles').select('name, role, avatar_url').eq('id', id).maybeSingle()
      if (fb.data) return fb.data as CachedChildProfileRow
      if (fb.error) {
        if (!isRetriableMissingColumnError(fb.error)) {
          logSupabaseCacheFailure('profiles fallback', fb.error.message)
          return null
        }
        const fb2 = await supabase.from('profiles').select('name, role').eq('id', id).maybeSingle()
        return (fb2.data as CachedChildProfileRow | null) ?? null
      }
    }
    return null
  }
  return null
})

export type CachedFamilyLinkRow = { id: string; parent_id: string }

/**
 * 이 자녀에 연결된 `family_links` 전부 (마켓·미션이 같은 행을 씁니다).
 */
export const getCachedFamilyLinksForChild = cache(async (childId: string): Promise<CachedFamilyLinkRow[]> => {
  for (let attempt = 0; attempt < SUPABASE_FETCH_RETRY_DELAYS_MS.length; attempt++) {
    await delayMs(SUPABASE_FETCH_RETRY_DELAYS_MS[attempt] ?? 0)
    const supabase = await createClient()
    const { data, error } = await supabase.from('family_links').select('id, parent_id').eq('child_id', childId)
    if (!error) {
      return (data ?? []) as CachedFamilyLinkRow[]
    }
    if (
      isTransientFetchErrorMessage(error.message) &&
      attempt < SUPABASE_FETCH_RETRY_DELAYS_MS.length - 1
    ) {
      continue
    }
    logSupabaseCacheFailure('family_links', error.message)
    return []
  }
  return []
})

export type CachedFamilyLinkChildRow = { child_id: string }

/**
 * 부모 계정에 연결된 자녀 목록 (`created_at` 오름차순 — enter-child-ui 등에서 「첫 자녀」 선택용).
 * `getCachedFamilyLinksForChild` 와 짝을 이루어 같은 테이블을 요청 단위로 한 번만 읽게 합니다.
 */
export const getCachedFamilyLinksForParent = cache(async (parentId: string): Promise<CachedFamilyLinkChildRow[]> => {
  for (let attempt = 0; attempt < SUPABASE_FETCH_RETRY_DELAYS_MS.length; attempt++) {
    await delayMs(SUPABASE_FETCH_RETRY_DELAYS_MS[attempt] ?? 0)
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('family_links')
      .select('child_id')
      .eq('parent_id', parentId)
      .order('created_at', { ascending: true })
    if (!error) {
      return (data ?? []) as CachedFamilyLinkChildRow[]
    }
    if (
      isTransientFetchErrorMessage(error.message) &&
      attempt < SUPABASE_FETCH_RETRY_DELAYS_MS.length - 1
    ) {
      continue
    }
    logSupabaseCacheFailure('family_links by parent', error.message)
    return []
  }
  return []
})
