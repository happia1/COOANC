import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolvePostLoginRedirectForUser } from '@/lib/resolvePostLoginRedirect'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/post-login-redirect
 * 로그인·자동 로그인 직후 **한 번의 서버 조회**로 다음 화면을 정합니다.
 * 클라이언트는 이 응답만 보고 `window.location.replace` 로 바로 이동합니다.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const plan = await resolvePostLoginRedirectForUser(supabase, user)

    return NextResponse.json(plan)
  } catch (error) {
    console.error('[api/auth/post-login-redirect]', error)
    return NextResponse.json({ authenticated: false }, { status: 200 })
  }
}
