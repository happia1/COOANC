import { createBrowserClient } from '@supabase/ssr'
import { requireSupabaseUrlAndAnonKey } from '@/lib/supabase/requireEnv'

/**
 * 브라우저 환경에서 Supabase와 통신하기 위한 클라이언트 생성
 * NEXT_PUBLIC_ 접두사가 붙은 환경 변수는 브라우저에 노출됩니다.
 */
export const createClient = () => {
  const { url, anonKey } = requireSupabaseUrlAndAnonKey()
  return createBrowserClient(url, anonKey)
}
