import type { SupabaseClient } from '@supabase/supabase-js'
import { runSerializedBrowserAuthOp } from '@/lib/supabase/browserAuthQueue'

/** 마지막으로 확인한 부모 user id — family_links 캐시 키 */
let cachedUserId: string | null = null
/** 연결된 자녀 id 목록 — polling 마다 family_links 를 다시 읽지 않도록 캐시 */
let cachedParentChildIds: string[] | null = null
let authListenerInstalled = false

function installAuthCacheInvalidator(supabase: SupabaseClient) {
  if (authListenerInstalled) return
  authListenerInstalled = true
  supabase.auth.onAuthStateChange((_event, session) => {
    const nextId = session?.user?.id ?? null
    if (nextId !== cachedUserId) {
      cachedUserId = nextId
      cachedParentChildIds = null
    }
  })
}

/**
 * `getUser()` 대신 로컬 세션에서 user id 만 읽습니다.
 * 비개발자: 30초마다 Supabase 서버에 "로그인 맞나?" 를 묻지 않고,
 * 이미 브라우저에 저장된 로그인 정보를 재사용합니다.
 */
export async function getBrowserSessionUserId(supabase: SupabaseClient): Promise<string | null> {
  installAuthCacheInvalidator(supabase)
  return runSerializedBrowserAuthOp(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const id = session?.user?.id ?? null
    cachedUserId = id
    if (!id) cachedParentChildIds = null
    return id
  })
}

/**
 * 부모 계정의 연결 자녀 id 목록 — 세션·family_links 를 요청당 1번만 조회합니다.
 */
export async function getCachedParentChildIds(supabase: SupabaseClient): Promise<string[]> {
  installAuthCacheInvalidator(supabase)
  const userId = await getBrowserSessionUserId(supabase)
  if (!userId) return []

  if (cachedUserId === userId && cachedParentChildIds) {
    return cachedParentChildIds
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
  if (profile?.role !== 'parent') {
    cachedParentChildIds = []
    cachedUserId = userId
    return []
  }

  const { data: links } = await supabase.from('family_links').select('child_id').eq('parent_id', userId)
  cachedParentChildIds = (links ?? [])
    .map((row: { child_id: string }) => row.child_id)
    .filter(Boolean)
  cachedUserId = userId
  return cachedParentChildIds
}

/** 로그아웃·계정 전환 시 캐시를 비웁니다 */
export function invalidateBrowserParentAuthCache() {
  cachedUserId = null
  cachedParentChildIds = null
}
