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
 * - 싱글톤으로 유지해 PostgREST·Auth 설정을 재사용합니다.
 * - Realtime(WebSocket)은 끊지 않습니다. 자녀 홈(`ChildScreen`)이 부모 「다시하기」 알림을
 *   `postgres_changes`·Broadcast 로 받기 때문입니다. (예전에는 미사용이라 disconnect 했음)
 */
export const createClient = () => {
  const cached = globalThis.__cooancSupabaseBrowserClient
  if (cached) return cached
  const { url, anonKey } = requireSupabaseUrlAndAnonKey()
  const client = createBrowserClient(url, anonKey)
  globalThis.__cooancSupabaseBrowserClient = client
  return client
}
