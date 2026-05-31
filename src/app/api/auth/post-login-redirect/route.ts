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

    // #region agent log
    fetch('http://127.0.0.1:7447/ingest/9dd0682d-d3af-41fb-8d82-be18fff89b7a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '65823a' },
      body: JSON.stringify({
        sessionId: '65823a',
        location: 'post-login-redirect/route.ts:GET',
        message: 'post-login redirect plan',
        data: {
          authenticated: plan.authenticated,
          role: plan.authenticated ? plan.role : null,
          kind: plan.authenticated && plan.role === 'parent' ? plan.kind : null,
        },
        hypothesisId: 'auto-login-hops',
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion

    return NextResponse.json(plan)
  } catch (error) {
    console.error('[api/auth/post-login-redirect]', error)
    return NextResponse.json({ authenticated: false }, { status: 200 })
  }
}
