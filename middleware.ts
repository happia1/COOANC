import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { shouldClearAuthCookiesAfterError } from '@/lib/supabase/authSessionErrors'
import { requireSupabaseUrlAndAnonKey } from '@/lib/supabase/requireEnv'

/**
 * Supabase 세션 쿠키 갱신 미들웨어
 * localStorage 접근은 클라이언트 전용 — 여기서는 쿠키 기반 세션 리프레시만 처리
 *
 * Next.js 16 + Turbopack 환경에서는 `src/middleware.ts` 대신
 * 프로젝트 루트의 `middleware.ts` 를 두는 편이 모듈 해석 오류를 피하기 쉽습니다.
 *
 * 리프레시 토큰이 서버에서 무효면(getUser 시 갱신 실패) 깨진 쿠키를 남기지 않도록
 * signOut 으로 응답 쿠키를 정리합니다. (콘솔의 AuthApiError 반복 완화)
 */
export async function middleware(request: NextRequest) {
  const { url, anonKey } = requireSupabaseUrlAndAnonKey()
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 세션 검증·갱신 (만료 시 리프레시). 실패 시 error 로 내려옵니다.
  const { error: authError } = await supabase.auth.getUser()

  if (authError && shouldClearAuthCookiesAfterError(authError)) {
    // 응답에 "쿠키 삭제" 지시를 붙여 클라이언트가 다시 로그인할 수 있게 합니다.
    await supabase.auth.signOut({ scope: 'local' })
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
