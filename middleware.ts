import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { shouldClearAuthCookiesAfterError } from '@/lib/supabase/authSessionErrors'
import {
  applyCookieCacheHeaders,
  type SupabaseCookieHeaders,
} from '@/lib/supabase/supabaseSetAllCacheHeaders'
import { requireSupabaseUrlAndAnonKey } from '@/lib/supabase/requireEnv'
import {
  SUPABASE_MIDDLEWARE_FETCH_TIMEOUT_MS,
  wrapFetchWithTimeout,
} from '@/lib/supabase/fetchWithTimeout'
import { resolvePostLoginRedirectForUser } from '@/lib/resolvePostLoginRedirect'

/** 로그인·가입 등 — 세션 갱신(getUser) 없이 바로 통과시킬 공개 경로 */
const MIDDLEWARE_AUTH_SKIP_PREFIXES = ['/login', '/signup', '/auth/']

/**
 * Supabase 세션 쿠키 갱신 미들웨어
 * localStorage 접근은 클라이언트 전용 — 여기서는 쿠키 기반 세션 리프레시만 처리
 *
 * Next.js 16 + Turbopack 환경에서는 `src/middleware.ts` 대신
 * 프로젝트 루트의 `middleware.ts` 를 두는 편이 모듈 해석 오류를 피하기 쉽습니다.
 *
 * 리프레시 토큰이 서버에서 무효면(getUser 시 갱신 실패) 깨진 쿠키를 남기지 않도록
 * signOut 으로 응답 쿠키를 정리합니다. (콘솔의 AuthApiError 반복 완화)
 *
 * ── 자녀 앱 `/home` 과 `PARENT_AS_CHILD_COOKIE` ──
 * 부모 계정인지·미리보기 쿠키가 있는지 판별하려면 `profiles.role` 조회가 필요합니다.
 * Edge 미들웨어에서 매 요청 DB 조회를 추가하면 오히려 부하가 늘고, JWT 만으로는 역할을 알 수 없습니다.
 * 루트 `/` 에서 역할별 이동은 아래 에서 처리하고, 「부모가 자녀 UI 미리보기」등 세부 분기는
 * `getActorChildContext` 등 서버 레이어를 따릅니다.
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  /**
   * API Route Handler 는 `createClient()` + `getUser()` 로 세션을 직접 읽습니다.
   * 여기서까지 Auth 를 호출하면 Supabase `/auth/v1/user` 가 느릈 때(504) 요청마다
   * getUser 가 2번(미들웨어 + API) 돌고, Edge 미들웨어가 Vercel 제한 시간을 넘깁니다
   * (MIDDLEWARE_INVOCATION_TIMEOUT).
   */
  if (pathname.startsWith('/api/')) {
    return NextResponse.next({ request })
  }

  if (MIDDLEWARE_AUTH_SKIP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.next({ request })
  }

  const { url, anonKey } = requireSupabaseUrlAndAnonKey()
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    url,
    anonKey,
    {
      global: {
        /**
         * 미들웨어는 짧게(재시도 없이) — Vercel 미들웨어 실행 한도를 넘기지 않게.
         * 예전에는 12초 × 최대 3회라 30초를 넘겨 504(MIDDLEWARE_INVOCATION_TIMEOUT)로
         * 사이트 전체가 열리지 않는 일이 있었습니다.
         */
        fetch: wrapFetchWithTimeout(fetch, SUPABASE_MIDDLEWARE_FETCH_TIMEOUT_MS, 1),
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        /** Supabase SSR 은 두 번째 인수로 무캐시 헤더까지 넘깁니다 (@supabase/ssr `applyServerStorage`). */
        setAll(cookiesToSet, cookieHeaders?: SupabaseCookieHeaders) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
          applyCookieCacheHeaders(supabaseResponse.headers, cookieHeaders)
        },
      },
    },
  )

  /**
   * 세션 검증·갱신 (만료 시 리프레시).
   *
   * **실패해도 요청을 막지 않습니다(fail open).**
   * 비개발자 설명: 로그인 확인이 늦거나 실패했다고 해서 화면을 아예 못 열게 하면,
   * Supabase 가 잠깐 느린 것만으로 사이트 전체가 멈춥니다(504). 확인이 안 되면
   * 그냥 통과시키고, 각 화면이 자기 방식대로 로그인 여부를 다시 확인하게 둡니다.
   */
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null
  let authError: unknown = null
  try {
    const result = await supabase.auth.getUser()
    user = result.data.user
    authError = result.error
  } catch (err) {
    console.warn('[middleware] getUser 실패 — 인증 확인을 건너뜁니다:', err)
    return supabaseResponse
  }

  if (authError && shouldClearAuthCookiesAfterError(authError)) {
    // 응답에 "쿠키 삭제" 지시를 붙여 클라이언트가 다시 로그인할 수 있게 합니다.
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch (err) {
      console.warn('[middleware] signOut 실패:', err)
    }
  }

  /** `/` 에서 SSR 이 쿠키를 못 따라가거나 지연될 때를 대비해, 미들웨어 단계에서 곧바로 분기합니다. */
  if (pathname === '/') {
    const effectiveUser = authError && shouldClearAuthCookiesAfterError(authError) ? null : user

    const appendRefreshedSession = (r: NextResponse) => {
      let appended = false
      try {
        const list = typeof supabaseResponse.headers.getSetCookie === 'function'
          ? supabaseResponse.headers.getSetCookie()
          : []
        if (Array.isArray(list) && list.length > 0) {
          list.forEach((cookie) => r.headers.append('Set-Cookie', cookie))
          appended = list.length > 0
        }
      } catch {
        /* 일부 Edge 런타임에서 getSetCookie 가 없거나 실패할 수 있음 */
      }
      if (!appended) {
        try {
          const all = typeof supabaseResponse.cookies?.getAll === 'function'
            ? supabaseResponse.cookies.getAll()
            : []
          for (const c of all) {
            const { name, value } = c
            r.cookies.set(name, value)
          }
          if (all.length > 0) appended = true
        } catch {
          /* 무시 후 단일 헤더 시도 */
        }
      }
      if (!appended) {
        const fb = supabaseResponse.headers.get('set-cookie')
        if (fb) r.headers.append('Set-Cookie', fb)
      }
      ;(['cache-control', 'expires', 'pragma'] as const).forEach((h) => {
        const v = supabaseResponse.headers.get(h)
        if (v) r.headers.set(h, v)
      })
      return r
    }

    if (!effectiveUser) {
      return appendRefreshedSession(NextResponse.redirect(new URL('/login', request.url)))
    }

    const role = effectiveUser.user_metadata?.role as string | undefined

    if (role === 'child') {
      return appendRefreshedSession(NextResponse.redirect(new URL('/home', request.url)))
    }

    /**
     * 여기서 한 번 더 DB 를 읽습니다. 느리면 미들웨어 한도를 넘길 수 있는데,
     * 루트 페이지(`src/app/page.tsx`)가 **같은 규칙으로 다시 분기**하므로
     * 실패하면 그냥 통과시키고 페이지에 맡깁니다(느려도 사이트가 멈추지 않게).
     */
    try {
      const plan = await resolvePostLoginRedirectForUser(supabase, effectiveUser)
      if (!plan.authenticated) {
        return appendRefreshedSession(NextResponse.redirect(new URL('/login', request.url)))
      }
      return appendRefreshedSession(NextResponse.redirect(new URL(plan.redirectTo, request.url)))
    } catch (err) {
      console.warn('[middleware] 루트 분기 계산 실패 — 페이지에 맡깁니다:', err)
      return supabaseResponse
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
