import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeUuidParam } from '@/lib/normalizeUuid'
import { PARENT_AS_CHILD_COOKIE, PARENT_AS_CHILD_COOKIE_MAX_AGE } from '@/lib/parentAsChildCookie'

/**
 * GET /api/parent/enter-child-ui?childId=UUID (childId 생략 가능)
 * - 로그인한 사용자가 부모이고, 해당 자녀와 family_links 로 연결돼 있으면
 *   HttpOnly 쿠키를 심고 /home 으로 보냅니다.
 *
 * Next.js 가 `<Link>` 프리페치 시 같은 URL 에 `?_rsc=…` 만 붙인 요청을 추가로 보낼 수 있습니다.
 * 이때 `childId` 쿼리가 빠진 채로 오며, 리다이렉트(302) 응답이 RSC 클라이언트와 맞지 않아 **400** 으로 보이는 경우가 있습니다.
 * `_rsc` 가 있으면 쿠키·리다이렉트 없이 **200 JSON no-op** 으로 끝냅니다. (실제 진입은 첫 요청 `?childId=…` 로 이미 처리됨)
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    : { data: null }

  const childIdParam = req.nextUrl.searchParams.get('childId')
  const rsc = req.nextUrl.searchParams.get('_rsc')

  /** 개발 환경 또는 RSC 보조 요청일 때만 — user/role/쿼리 불일치 원인 추적 */
  if (process.env.NODE_ENV === 'development' || rsc !== null) {
    console.log('enter-child-ui debug:', {
      userId: user?.id,
      role: profile?.role,
      childId: childIdParam,
      rsc,
    })
  }

  if (req.nextUrl.searchParams.has('_rsc')) {
    return NextResponse.json({ ok: true, noop: true, reason: 'next-rsc-prefetch-skip' }, { status: 200 })
  }

  if (!user) {
    return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })
  }

  if (profile?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 이용할 수 있어요' }, { status: 403 })
  }

  /** 주소창에서 온 childId — 없거나 깨졌으면 아래에서 첫 연결 자녀로 채움 */
  let childId = normalizeUuidParam(childIdParam)

  if (!childId) {
    const { data: links, error: linksErr } = await supabase
      .from('family_links')
      .select('child_id')
      .eq('parent_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)

    if (linksErr) {
      console.error('[enter-child-ui] family_links fallback:', linksErr.message)
    }

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
