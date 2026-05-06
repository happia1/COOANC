import { createBrowserClient } from '@supabase/ssr'
import { requireSupabaseUrlAndAnonKey } from '@/lib/supabase/requireEnv'

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>

declare global {
  // eslint-disable-next-line no-var
  var __cooancSupabaseBrowserClient: BrowserSupabaseClient | undefined
}

/**
 * 개발 중 콘솔에만: GoTrue 가 던지는 `AuthRetryableFetchError` 는 메시지가 비어 `{}` 처럼 보일 때가 많습니다.
 * 실패한 `/auth/v1/` 요청의 HTTP 상태·URL·응답 앞부분을 한 줄로 남겨 원인(504, 401, 잘못된 URL 등)을 찾기 쉽게 합니다.
 */
function wrapFetchWithDevAuthLogging(baseFetch: typeof fetch): typeof fetch {
  return async (input, init) => {
    const res = await baseFetch(input, init)
    if (res.ok) return res
    try {
      const href =
        typeof input === 'string'
          ? input
          : input instanceof Request
            ? input.url
            : String(input)
      if (!href.includes('/auth/v1/')) return res

      const bodyPreview = await res
        .clone()
        .text()
        .then((t) => (t.trim() ? t.slice(0, 240) : '(본문 없음)'))
        .catch(() => '(본문 읽기 실패)')

      console.warn(
        '[Supabase Auth HTTP 실패 — 콘솔의 AuthRetryableFetchError 와 같은 원인일 수 있음]',
        res.status,
        res.statusText,
        href,
        bodyPreview,
      )
    } catch {
      /* 로깅 실패는 무시 */
    }
    return res
  }
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

  /** 프로덕션 빌드에는 기본 fetch 그대로(불필요한 로그·클론 비용 없음) */
  const options =
    process.env.NODE_ENV === 'development'
      ? { global: { fetch: wrapFetchWithDevAuthLogging(fetch.bind(globalThis)) } }
      : undefined

  const client = createBrowserClient(url, anonKey, options)
  globalThis.__cooancSupabaseBrowserClient = client
  return client
}
