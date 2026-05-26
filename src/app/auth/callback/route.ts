import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Supabase 이메일 인증 콜백 핸들러
 * - 이메일 확인 링크 클릭 시 Supabase가 이 URL로 리다이렉트
 * - code를 세션으로 교환한 뒤 역할에 따라 분기
 *   - 신규 부모(자녀 미등록) → /onboarding
 *   - 기존 부모(자녀 있음)   → / (루트에서 자녀 수·localStorage 에 따라 자녀 화면 또는 부모 홈)
 *   - 자녀                  → /home
 *
 * 비개발자: 세션 쿠키는 **리다이렉트 응답 자체**에 붙여야 브라우저가 받습니다.
 * 예전처럼 `cookies()` 에만 넣으면 가끔 쿠키가 빠져 "로그인이 안 된다"처럼 보일 수 있습니다.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const failUrl = `${origin}/login?error=auth_callback_failed`

  /** Supabase `setAll` 이 여러 번 불릴 때마다 최신 이름·값으로 모읍니다. */
  const pendingCookies = new Map<string, { value: string; options: Parameters<NextResponse['cookies']['set']>[2] }>()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!supabaseUrl || !anon) {
    return NextResponse.redirect(failUrl)
  }

  const supabase = createServerClient(supabaseUrl, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          pendingCookies.set(name, { value, options })
        }
      },
    },
  })

  /** 모아 둔 쿠키를 브라우저로 보내는 리다이렉트를 만듭니다. */
  function redirectWithSessionCookies(destination: string) {
    const res = NextResponse.redirect(destination)
    for (const [name, { value, options }] of pendingCookies) {
      res.cookies.set(name, value, options)
    }
    return res
  }

  if (!code) {
    return NextResponse.redirect(failUrl)
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !session) {
    return redirectWithSessionCookies(failUrl)
  }

  const role = session.user.user_metadata?.role as string | undefined

  if (role === 'child') {
    return redirectWithSessionCookies(`${origin}/home`)
  }

  // 부모: 자녀 등록 여부 확인
  const { count } = await supabase
    .from('family_links')
    .select('*', { count: 'exact', head: true })
    .eq('parent_id', session.user.id)

  if (!count || count === 0) {
    return redirectWithSessionCookies(`${origin}/onboarding`)
  }
  return redirectWithSessionCookies(`${origin}/`)
}
