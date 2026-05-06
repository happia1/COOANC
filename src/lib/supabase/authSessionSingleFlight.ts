import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { runSerializedBrowserAuthOp } from '@/lib/supabase/browserAuthQueue'

/**
 * 로그인 화면 등에서 `auth.getSession()` 을 호출합니다.
 * React Strict Mode(이펙트 2회) + 다른 컴포넌트의 Supabase(Auth) 접근과 겹치지 않도록
 * `runSerializedBrowserAuthOp` 로 한 줄로 처리합니다.
 */
export function getAuthSessionSingleFlight(supabase: SupabaseClient): Promise<Session | null> {
  return runSerializedBrowserAuthOp(async () => {
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        console.warn('[getAuthSessionSingleFlight]', error.message)
        return null
      }
      return data.session ?? null
    } catch (e) {
      console.warn('[getAuthSessionSingleFlight] getSession 예외:', e)
      return null
    }
  })
}
