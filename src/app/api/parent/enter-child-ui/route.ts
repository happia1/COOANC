import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeUuidParam } from '@/lib/normalizeUuid'
import { PARENT_AS_CHILD_COOKIE, PARENT_AS_CHILD_COOKIE_MAX_AGE } from '@/lib/parentAsChildCookie'

/**
 * GET /api/parent/enter-child-ui?childId=UUID (childId 생략 가능)
 * - 로그인한 사용자가 부모이고, 해당 자녀와 family_links 로 연결돼 있으면
 *   HttpOnly 쿠키를 심고 /home 으로 보냅니다.
 * - 이후 자녀 앱 레이아웃이 이 쿠키를 읽어 같은 화면을 그립니다.
 *
 * 400 이 나던 경우(요약):
 * - 주소에 자녀 id 가 없거나, `undefined` 문자열처럼 잘못 붙은 경우 → normalizeUuidParam 이 실패했음.
 * - 이제는 그럴 때 DB 에서 부모에게 연결된 첫 자녀 id 를 기본값으로 씁니다.
 * - 연결된 자녀가 한 명도 없으면 JSON 에러 대신 부모 홈으로 안내 이동합니다.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 이용할 수 있어요' }, { status: 403 })
  }

  /** 주소창에서 온 childId — 없거나 깨졌으면 아래에서 첫 연결 자녀로 채움 */
  let childId = normalizeUuidParam(req.nextUrl.searchParams.get('childId'))

  if (!childId) {
    const { data: links } = await supabase
      .from('family_links')
      .select('child_id')
      .eq('parent_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)

    const first = links?.[0]?.child_id
    childId = normalizeUuidParam(first ?? null)
  }

  /** 자녀가 아예 없으면 쿠키 없이 부모 홈으로 — 온보딩 유도 */
  if (!childId) {
    return NextResponse.redirect(new URL('/parent/home', req.nextUrl.origin))
  }

  const { data: link } = await supabase
    .from('family_links')
    .select('id')
    .eq('parent_id', user.id)
    .eq('child_id', childId)
    .maybeSingle()

  if (!link) {
    return NextResponse.json({ error: '연결된 자녀가 아니에요' }, { status: 403 })
  }

  const url = new URL('/home', req.nextUrl.origin)
  const res = NextResponse.redirect(url)
  res.cookies.set(PARENT_AS_CHILD_COOKIE, childId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: PARENT_AS_CHILD_COOKIE_MAX_AGE,
  })
  return res
}
