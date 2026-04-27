import { NextRequest, NextResponse } from 'next/server'
import { PARENT_AS_CHILD_COOKIE } from '@/lib/parentAsChildCookie'

/**
 * GET /api/parent/exit-child-ui
 * - 부모가 자녀 화면에서 「나가기」를 누를 때 호출합니다.
 * - 미리보기 쿠키를 지우고 부모 홈으로 돌려보냅니다.
 */
export async function GET(req: NextRequest) {
  // 쿠키 정리·리다이렉트 중 예외를 잡아 나가기 동작이 완전히 실패하지 않게 합니다.
  try {
    const url = new URL('/parent/home', req.nextUrl.origin)
    const res = NextResponse.redirect(url)
    res.cookies.set(PARENT_AS_CHILD_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 })
    return res
  } catch (error) {
    console.error('[api/parent/exit-child-ui] unexpected error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했어요. 다시 시도해주세요.' },
      { status: 500 },
    )
  }
}
