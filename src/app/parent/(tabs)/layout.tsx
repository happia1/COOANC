/**
 * 부모 앱 하단 탭(홈·루틴·승인) 공통 껍데기입니다.
 * - 상단바에 넘기는 「구매 승인 대기」개수는 여기서 조회해, 홈 화면과 중복 쿼리를 피합니다.
 */
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import ParentNavBar from '@/components/parent/ParentNavBar'
import ParentTopBar from '@/components/parent/ParentTopBar'
import ParentNewPurchaseRequestModal from '@/components/parent/ParentNewPurchaseRequestModal'
import ParentStickerBoardCompleteModal from '@/components/parent/ParentStickerBoardCompleteModal'

export default async function ParentTabsLayout({ children }: { children: ReactNode }) {
  /** 상단 알람 아이콘·시트에 넘길 「구매 승인 대기」 건수 — 홈 배너 대신 여기서 한 번만 조회합니다 */
  let pendingApprovalCount = 0
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role === 'parent') {
      const { data: links } = await supabase.from('family_links').select('child_id').eq('parent_id', user.id)
      const childIds = (links ?? []).map((l) => l.child_id)
      if (childIds.length > 0) {
        const pendingRes = await supabase
          .from('purchase_requests')
          .select('id', { count: 'exact', head: true })
          .in('child_id', childIds)
          .in('status', ['pending', 'parent_buying'])
        pendingApprovalCount = (pendingRes as unknown as { count: number | null }).count ?? 0
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50 flex flex-col">
      <ParentTopBar pendingApprovalCount={pendingApprovalCount} />
      <main className="flex-1 overflow-y-auto w-full max-w-md mx-auto px-4 pt-4 pb-24">
        {children}
      </main>
      <ParentNewPurchaseRequestModal />
      <ParentStickerBoardCompleteModal />
      <ParentNavBar />
    </div>
  )
}
