import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolvePostLoginRedirectForUser } from '@/lib/resolvePostLoginRedirect'

export const dynamic = 'force-dynamic'

/**
 * 루트(/) — 로그인 여부와 계정 역할만 보고 이동합니다.
 * 미들웨어와 같은 `resolvePostLoginRedirectForUser` 규칙을 씁니다.
 */
export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const plan = await resolvePostLoginRedirectForUser(supabase, user)

  if (!plan.authenticated) {
    redirect('/login')
  }

  redirect(plan.redirectTo)
}
