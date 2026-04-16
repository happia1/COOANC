import { createBrowserClient } from '@supabase/ssr'
import { requireSupabaseUrlAndAnonKey } from '@/lib/supabase/requireEnv'

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>

declare global {
  // eslint-disable-next-line no-var
  var __cooancSupabaseBrowserClient: BrowserSupabaseClient | undefined
}

/**
 * 브라우저 환경에서 Supabase와 통신하기 위한 클라이언트 생성
 * NEXT_PUBLIC_ 접두사가 붙은 환경 변수는 브라우저에 노출됩니다.
 * - 싱글톤으로 유지해 탭 전환 시 같은 Realtime WebSocket 연결을 재사용합니다.
 */
export const createClient = () => {
  const cached = globalThis.__cooancSupabaseBrowserClient
  if (cached) return cached
  const { url, anonKey } = requireSupabaseUrlAndAnonKey()
  const client = createBrowserClient(url, anonKey)
  globalThis.__cooancSupabaseBrowserClient = client
  return client
}
