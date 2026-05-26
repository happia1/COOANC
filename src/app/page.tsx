import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * 루트(/) — 로그인 여부와 계정 역할만 보고 이동합니다.
 *
 * 비개발자 설명:
 * - 예전에는 이 페이지를 **브라우저(클라이언트)** 에서 Supabase 사용자를 물어봤는데,
 *   서버가 심어 주는 세션 쿠키가 `HttpOnly` 면 브라우저 자바스크립트에서 읽을 수 없어요.
 * - 그래서 「로그인 API 는 성공했는데도 곧바로 로그인 화면으로 돌아간다」가 될 수 있었습니다.
 * - 지금은 **서버**(Next 가 요청 헤더에 실은 쿠키를 그대로 읽을 수 있음)에서 사용자를 확인한 뒤
 *   역할에 맞는 주소로 안내(리다이렉트)합니다.
 *
 * 부모 계정 진입 규칙(요구사항):
 * - 자녀가 없으면 → 온보딩(자녀 등록 유도)
 * - 자녀가 한 명 → 곧바로 그 아이의 자녀 화면(부모 미리보기 쿠키 설정 API 경유)
 * - 자녀가 둘 이상 → `localStorage` 의 `defaultChildId` 를 읽을 수 없으므로 `/parent/child-entry` 로 보낸 뒤
 *   거기서 저장값이 있으면 해당 자녀 화면, 없으면 부모 홈으로 갑니다.
 */
export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = user.user_metadata?.role as string | undefined

  if (role === 'child') {
    redirect('/home')
  }

  const { data: familyRows, count } = await supabase
    .from('family_links')
    .select('child_id', { count: 'exact' })
    .eq('parent_id', user.id)

  const n = count ?? 0
  if (!n || n === 0) {
    redirect('/onboarding')
  }

  if (n === 1) {
    const onlyId = familyRows?.[0]?.child_id as string | undefined
    if (onlyId) {
      redirect(`/api/parent/enter-child-ui?childId=${encodeURIComponent(onlyId)}`)
    }
    redirect('/onboarding')
  }

  redirect('/parent/child-entry')
}
