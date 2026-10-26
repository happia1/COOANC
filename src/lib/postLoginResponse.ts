import { NextResponse } from 'next/server'
import type { PostLoginRedirectPlan } from '@/lib/resolvePostLoginRedirect'
import { PARENT_AS_CHILD_COOKIE, PARENT_AS_CHILD_COOKIE_MAX_AGE } from '@/lib/parentAsChildCookie'

export function postLoginResponse(plan: PostLoginRedirectPlan, cookieResponse?: NextResponse) {
  const preview = plan.authenticated && plan.role === 'parent' && plan.kind === 'single_child'
  const response = NextResponse.json({ ok: true, ...plan, ...(preview ? { redirectTo: '/home' } : {}) },
    { headers: { 'Cache-Control': 'private, no-store' } })
  cookieResponse?.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
  if (preview) response.cookies.set(PARENT_AS_CHILD_COOKIE, plan.childId, {
    httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production', maxAge: PARENT_AS_CHILD_COOKIE_MAX_AGE,
  })
  return response
}
