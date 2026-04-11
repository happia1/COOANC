import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { requireSupabaseUrlAndAnonKey } from '@/lib/supabase/requireEnv'

/**
 * 서버 환경(Server Components, Actions, Route Handlers)에서
 * 사용자 세션(쿠키)을 유지하며 Supabase와 통신하는 클라이언트
 */
export const createClient = async () => {
  const { url, anonKey } = requireSupabaseUrlAndAnonKey()
  const cookieStore = await cookies()

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // 서버 컴포넌트에서 쿠키를 수정하려 할 때 발생하는 오류 방지
          }
        },
      },
    },
  )
}
