import { NextRequest, NextResponse } from 'next/server'
import {
  CONTENT_ADMIN_COOKIE,
  CONTENT_ADMIN_SESSION_MAX_AGE,
  createAdminSessionToken,
  verifyAdminPassword,
} from '@/lib/adminContentAccess'

/**
 * POST /api/admin/dev-login — body: { password }
 * 로그인 화면 맨 아래 「개발자 로그인」에서 호출합니다.
 * 성공하면 서명된 세션 토큰을 httpOnly 쿠키로 심어 `/admin/content` 에 들어갈 수 있게 합니다.
 * (비밀번호는 서버 환경변수 `CONTENT_ADMIN_PASSWORD` 로만 비교하고, 쿠키에도 넣지 않습니다.)
 */
export async function POST(req: NextRequest) {
  let password: unknown
  try {
    const body = await req.json()
    password = body?.password
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  /** 무차별 대입을 조금이라도 늦추기 위한 최소 지연 */
  await new Promise((resolve) => setTimeout(resolve, 400))

  if (!verifyAdminPassword(password)) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않아요' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(CONTENT_ADMIN_COOKIE, createAdminSessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: CONTENT_ADMIN_SESSION_MAX_AGE,
  })
  return res
}

/** DELETE /api/admin/dev-login — 개발자 세션 종료 */
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(CONTENT_ADMIN_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return res
}
