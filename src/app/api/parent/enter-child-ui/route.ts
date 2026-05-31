/**
 * 부모가 「자녀 화면으로 보기」로 들어올 때 호출하는 API입니다.
 * `childAppDataCache` 의 React `cache` 로 family_links 조회를 묶어, 같은 요청에서 중복 DB 왕복을 줄입니다.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeUuidParam } from '@/lib/normalizeUuid'
import { PARENT_AS_CHILD_COOKIE, PARENT_AS_CHILD_COOKIE_MAX_AGE } from '@/lib/parentAsChildCookie'
import { getCachedProfileRowById, getCachedFamilyLinksForChild, getCachedFamilyLinksForParent } from '@/lib/childAppDataCache'

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
  // 캐시·쿠키·리다이렉트 경로의 예상 밖 오류를 잡아 부모 UI 전환이 멈추지 않게 합니다.
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const profile = user ? await getCachedProfileRowById(user.id) : null

    const childIdParam = req.nextUrl.searchParams.get('childId')

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
      /** React `cache` — 같은 요청 안에서 자녀 레이아웃과 중복 조회를 합칩니다 */
      const links = await getCachedFamilyLinksForParent(user.id)
      const first = links[0]?.child_id
      childId = normalizeUuidParam(first ?? null)
    }

    /** 자녀가 아예 없으면 쿠키 없이 부모 홈으로 — 온보딩 유도 */
    if (!childId) {
      return NextResponse.redirect(new URL('/parent/home', req.nextUrl.origin))
    }

    /** 자녀 기준으로 이미 캐시된 링크 행에서 부모 일치 여부만 확인 (별도 round-trip 제거) */
    const familyRows = await getCachedFamilyLinksForChild(childId)
    const linked = familyRows.some((row) => row.parent_id === user.id)
    if (!linked) {
      return NextResponse.json({ error: '연결된 자녀가 아니에요' }, { status: 403 })
    }

    const url = new URL('/home', req.nextUrl.origin)
    const wantsJson = req.nextUrl.searchParams.has('json')

    if (wantsJson) {
      const res = NextResponse.json({ ok: true, redirectTo: url.pathname })
      res.cookies.set(PARENT_AS_CHILD_COOKIE, childId, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: PARENT_AS_CHILD_COOKIE_MAX_AGE,
      })
      return res
    }

    const res = NextResponse.redirect(url)
    res.cookies.set(PARENT_AS_CHILD_COOKIE, childId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: PARENT_AS_CHILD_COOKIE_MAX_AGE,
    })
    return res
  } catch (error) {
    console.error('[api/parent/enter-child-ui] unexpected error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했어요. 다시 시도해주세요.' },
      { status: 500 },
    )
  }
}
