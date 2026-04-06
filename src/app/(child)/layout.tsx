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

  // `h-dvh` + `overflow-hidden`: 홈·미션 탭이 위아래 스크롤 없이 한 화면에 들어가도록 전체 높이를 기기 화면에 맞춤
  return (
    <div className="relative flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-gradient-to-b from-sky-100/90 via-amber-50/50 to-green-50/80">
      <ChildTopBar childName={childName} isParentPreview={ctx.isParentPreview} />
      {/**
       * `min-h-0` + `flex` 로 자식이 뷰포트 높이를 넘지 않게 할 수 있음(홈·미션 한 화면).
       * 세로 스크롤이 필요한 탭(마켓·스티커)은 각 탭 루트에 `overflow-y-auto` 를 둠.
       * `pb`: 하단 독 높이(60px) + 소량 여유 — 하단 패널과 독 사이 빈 화면을 줄임.
       */}
      <main className="relative z-10 mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-hidden px-4 pb-[calc(60px+0.35rem)] pt-4">
        {children}
      </main>
      <ChildNavBar />
    </div>
  )
}
