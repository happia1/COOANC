/**
 * `/parent` 이하 모든 화면을 감싸는 레이아웃입니다.
 *
 * 비개발자 설명:
 * - 부모 앱은 주소가 `/parent/home`, `/parent/routine` 처럼 `/parent` 로 시작합니다.
 * - 여기서는 「구매 승인 대기 몇 건인지」를 한 번만 조회해, 상단 종·알람에 쓰도록 넘깁니다.
 * - 실제 상단·하단 바를 그리는 일은 `ParentAppChrome` 이 담당합니다(주소가 `/parent` 일 때는 바를 숨깁니다).
 */
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import ParentAppChrome from '@/components/parent/ParentAppChrome'
import { getCachedParentAuth } from '@/lib/parentServerAuthCache'

export default async function ParentLayout({ children }: { children: ReactNode }) {
  /** 상단 알람·시트에 넘길 「구매 승인 대기」 건수 — 로그인·부모 역할·자녀 연결 후에만 조회합니다 */
  let pendingApprovalCount = 0
  const auth = await getCachedParentAuth()

  if (auth?.user && auth.profile?.role === 'parent') {
    const childIds = auth.familyLinks.map((l) => l.child_id)
    if (childIds.length > 0) {
      const supabase = await createClient()
      const pendingRes = await supabase
        .from('purchase_requests')
        .select('id', { count: 'exact', head: true })
        .in('child_id', childIds)
        .in('status', ['pending', 'parent_buying'])
      pendingApprovalCount = (pendingRes as unknown as { count: number | null }).count ?? 0
    }
  }

  return <ParentAppChrome pendingApprovalCount={pendingApprovalCount}>{children}</ParentAppChrome>
}
