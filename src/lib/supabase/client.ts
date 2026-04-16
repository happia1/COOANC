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
 * - 자녀 앱은 `channel()` 구독을 쓰지 않으므로, 초기화 직후 Realtime 웹소켓을 끊어
 *   불필요한 `wss://…/realtime` 핸드셰이크(수백 ms~수 초)를 줄입니다.
 */
export const createClient = () => {
  const cached = globalThis.__cooancSupabaseBrowserClient
  if (cached) return cached
  const { url, anonKey } = requireSupabaseUrlAndAnonKey()
  const client = createBrowserClient(url, anonKey)
  globalThis.__cooancSupabaseBrowserClient = client
  if (typeof window !== 'undefined') {
    const tearDownRealtime = () => {
      void client.realtime.disconnect()
    }
    tearDownRealtime()
    /** 세션 갱신 시 SDK 가 다시 소켓을 열 수 있어, 로그인 상태에서도 한 번 더 끊습니다. */
    client.auth.onAuthStateChange(() => {
      tearDownRealtime()
    })
  }
  return client
}
