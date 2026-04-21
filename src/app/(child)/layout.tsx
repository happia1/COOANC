import type { ReactNode } from 'react'
import ChildNavBar from '@/components/child/ChildNavBar'
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
       * flex-col 모바일 / flex-row 태블릿 landscape
       * ChildNavBar가 DOM에서 먼저 오면 flex-row 시 자동으로 좌측 사이드바가 됩니다.
       */}
      <div className="relative flex h-dvh max-h-dvh min-h-0 flex-col overflow-x-hidden bg-gradient-to-b from-sky-100/90 via-amber-50/50 to-green-50/80 md:landscape:flex-row md:landscape:overflow-hidden">
        {/**
         * 모바일: fixed bottom-0 독바.
         * 태블릿 landscape: relative left-sidebar (ChildNavBar 내부에서 md:landscape:* 로 처리).
         */}
        <ChildNavBar isParentPreview={ctx.isParentPreview} />

        {/**
         * 나가기 버튼 — 모바일 전용 fixed top-left.
         * 태블릿 landscape에서는 HomeTab 왼쪽 패널 overlay 나가기를 사용합니다.
         */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <a
          href={exitHref}
          className="fixed left-3 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-white/75 shadow-md backdrop-blur-sm transition active:scale-95 md:landscape:hidden"
          style={{ top: 'max(12px, env(safe-area-inset-top))' }}
          aria-label="나가기"
        >
          <img src="/assets/img/common/ui/exit.png" alt="" width={20} height={20} className="h-5 w-5 object-contain" />
        </a>

        {/**
         * 모바일: 독바 높이(64px) + 여유만큼 bottom padding.
         * 태블릿 landscape: 독바가 left sidebar이므로 bottom padding 불필요, pt/px도 제거하여 HomeTab이 꽉 채우게.
         */}
        <main className="relative z-10 flex min-h-0 w-full flex-1 flex-col overflow-visible px-4 pb-[calc(64px+0.35rem)] pt-4 md:landscape:px-0 md:landscape:pt-0 md:landscape:pb-0 md:landscape:overflow-hidden">
          {children}
        </main>
      </div>
    </ChildAppProfileProvider>
  )
}
