import type { ReactNode } from 'react'
import { ChildAppProfileProvider } from '@/context/ProfileContext'
import { getCachedProfileRowById, getCachedFamilyLinksForChild } from '@/lib/childAppDataCache'
import { getActorChildContext } from '@/lib/getActorChildContext'

/**
 * 아이 앱 공통 레이아웃
 * - 모바일: flex-col — 하단 독바 fixed, main이 나머지 높이 차지
 * - 태블릿 landscape (md + landscape): flex-row — 좌측 독바 sidebar, main이 나머지 너비 차지
 * - 상단 바 없음 — 나가기(exit) 버튼은 fixed top-left (landscape에서는 숨김, HomeTab 왼쪽 패널 overlay 사용)
 *
 * NOTE: Tab swipe deferred — conflicts with inner horizontal scrolls
 */
export default async function ChildLayout({ children }: { children: ReactNode }) {
  const ctx = await getActorChildContext()
  const profileRow = await getCachedProfileRowById(ctx.actorChildId)
  const familyRows = await getCachedFamilyLinksForChild(ctx.actorChildId)
  const childName = profileRow?.name?.trim() || '쿠앵이'
  const childAvatarUrl = typeof profileRow?.avatar_url === 'string' ? profileRow.avatar_url.trim() || null : null
  const exitHref = ctx.isParentPreview ? '/api/parent/exit-child-ui' : '/parent/home'

  return (
    <ChildAppProfileProvider
      value={{
        childId: ctx.actorChildId,
        childName,
        childAvatarUrl,
        familyLinks: familyRows,
        exitHref,
      }}
    >
      {/**
       * ChildScreen이 fixed inset-0 z-[60] 으로 전체 화면을 덮으므로
       * ChildNavBar와 나가기 버튼은 제거했습니다.
       * main은 ChildScreen의 포탈 렌더링 기준점 역할만 합니다.
       */}
      <main className="relative h-dvh w-full overflow-hidden">
        {children}
      </main>
    </ChildAppProfileProvider>
  )
}
