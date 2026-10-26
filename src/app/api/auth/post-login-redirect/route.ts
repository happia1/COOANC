import { postLoginResponse } from '@/lib/postLoginResponse'
import { getUserForNavigation } from '@/lib/supabase/authSessionErrors'
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
    const user = await getUserForNavigation(supabase.auth)

    const plan = await resolvePostLoginRedirectForUser(supabase, user)

    return postLoginResponse(plan)
  } catch (error) {
    console.error('[api/auth/post-login-redirect]', error)
    return NextResponse.json({ error: '로그인 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
