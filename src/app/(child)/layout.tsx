import type { ReactNode } from 'react'
import ChildNavBar from '@/components/child/ChildNavBar'
import ChildTopBar from '@/components/child/ChildTopBar'
import { createClient } from '@/lib/supabase/server'
import { getActorChildContext } from '@/lib/getActorChildContext'

/**
 * 아이 앱 공통 레이아웃
 * - 모바일 컨테이너 (max-w-md)
 * - 기본은 연한 그라디언트 배경(홈 상단 풍경은 `HomeTab` 안에서만)
 * - 상단 내비게이션 바 (자녀 이름 칩 + 나가기)
 * - 하단 내비게이션 바 60px (홈·미션·마켓 3탭)
 *
 * 부모 계정은 기본적으로 여기로 오면 `/parent` 로 보내지 않고,
 * 「자녀 UI 열기」로 심은 쿠키가 있을 때만 같은 화면을 봅니다(getActorChildContext).
 */
export default async function ChildLayout({ children }: { children: ReactNode }) {
  const ctx = await getActorChildContext()
  const supabase = await createClient()

  const { data: childProfile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', ctx.actorChildId)
    .maybeSingle()

  let childName = '쿠앵이'
  if (childProfile?.name?.trim()) {
    childName = childProfile.name.trim()
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-b from-sky-100/90 via-amber-50/50 to-green-50/80">
      <ChildTopBar childName={childName} isParentPreview={ctx.isParentPreview} />
      <main className="relative z-10 flex-1 overflow-y-auto w-full max-w-md mx-auto px-4 pt-4 pb-24">
        {children}
      </main>
      <ChildNavBar />
    </div>
  )
}
