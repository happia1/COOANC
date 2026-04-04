import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Supabase 이메일 인증 콜백 핸들러
 * - 이메일 확인 링크 클릭 시 Supabase가 이 URL로 리다이렉트
 * - code를 세션으로 교환한 뒤 역할에 따라 분기
 *   - 신규 부모(자녀 미등록) → /onboarding
 *   - 기존 부모(자녀 있음)   → /parent
 *   - 자녀                  → /home
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && session) {
      const role = session.user.user_metadata?.role as string | undefined

      if (role === 'child') {
        return NextResponse.redirect(`${origin}/home`)
      }

      // 부모: 자녀 등록 여부 확인
      const { count } = await supabase
        .from('family_links')
        .select('*', { count: 'exact', head: true })
        .eq('parent_id', session.user.id)

      if (!count || count === 0) {
        return NextResponse.redirect(`${origin}/onboarding`)
      }
      return NextResponse.redirect(`${origin}/parent`)
    }
  }

  // 실패 시 로그인 페이지로
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
