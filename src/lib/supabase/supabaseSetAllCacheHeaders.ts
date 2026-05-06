/**
 * @supabase/ssr 의 `applyServerStorage` 는 `setAll(cookiesToSet, cacheHeaders)` 형태로
 * 무캐시 헤더(Cache-Control 등)까지 넘깁니다. 여기 무시하면 CDN·브라우저가 세션 답변을 캐시해
 * 다른 사람 세션이 새거나, 리프레시 직후 토큰이 꼬이는 현상을 유발할 수 있습니다.
 *
 * 비개발자: 로그인·토큰 갱신 결과를 「잠깐만 쓰고 버리게」 헤더로 표시해서, 브라우저가 예전 상태를 들고 놀지 않게 합니다.
 */
export type SupabaseCookieHeaders = Partial<Record<string, string>>

export function applyCookieCacheHeaders(target: Headers, cookieHeaders?: SupabaseCookieHeaders) {
  if (!cookieHeaders) return
  for (const [key, val] of Object.entries(cookieHeaders)) {
    if (val != null) target.set(key, val)
  }
}
