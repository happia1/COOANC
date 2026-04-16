import type { ReactNode } from 'react'
import ChildNavBar from '@/components/child/ChildNavBar'
import ChildTopBar from '@/components/child/ChildTopBar'
import { ChildAppProfileProvider } from '@/context/ProfileContext'
import { getCachedProfileRowById, getCachedFamilyLinksForChild } from '@/lib/childAppDataCache'
import { getActorChildContext } from '@/lib/getActorChildContext'

/**
 * 아이 앱 공통 레이아웃
 * - 모바일 컨테이너 (max-w-md)
 * - 기본은 연한 그라디언트 배경(홈 탭은 `HomeTab` 안에서 상단~꾸미기까지 풀 블리드 풍경 PNG 로 덮음)
 * - 상단 내비게이션 바 (자녀 이름 칩 + 나가기)
 * - 하단 내비게이션 바 60px (홈·미션·마켓 3탭)
 *
 * 부모 계정은 기본적으로 여기로 오면 `/parent` 로 보내지 않고,
 * 「자녀 UI 열기」로 심은 쿠키가 있을 때만 같은 화면을 봅니다(getActorChildContext).
 *
 * `/api/parent/enter-child-ui` 는 탭 전환 시 호출하지 않습니다. 부모 미리보기는
 * HttpOnly `PARENT_AS_CHILD_COOKIE` 만으로 유지됩니다.
 */
export default async function ChildLayout({ children }: { children: ReactNode }) {
  const ctx = await getActorChildContext()
  /** `childAppDataCache` — 홈·미션·마켓 페이지와 동일 키로 한 요청 안에서 재사용 */
  const profileRow = await getCachedProfileRowById(ctx.actorChildId)
  const familyRows = await getCachedFamilyLinksForChild(ctx.actorChildId)
  const childName = profileRow?.name?.trim() || '쿠앵이'
  const childAvatarUrl = typeof profileRow?.avatar_url === 'string' ? profileRow.avatar_url.trim() || null : null

  /**
   * `h-dvh` 로 한 화면 높이를 맞춥니다.
   * 세로 `overflow-hidden` 은 자식(미션 저금통 큰 스프라이트)이 위로 나올 때 잘릴 수 있어 두지 않습니다.
   * 가로로만 `overflow-x-hidden` 을 두어 독·패딩 밖으로 삐져 나온 요소 때문에 생기는 **가로 스크롤/스크롤바**를 줄입니다.
   */
  return (
    <ChildAppProfileProvider
      value={{
        childId: ctx.actorChildId,
        childName,
        childAvatarUrl,
        familyLinks: familyRows,
      }}
    >
      <div className="relative flex h-dvh max-h-dvh min-h-0 flex-col overflow-x-hidden bg-gradient-to-b from-sky-100/90 via-amber-50/50 to-green-50/80">
        <ChildTopBar isParentPreview={ctx.isParentPreview} />
        {/**
         * `min-h-0` + `flex` 로 자식이 뷰포트 높이를 넘지 않게 할 수 있음(홈·미션 한 화면).
         * 세로 스크롤이 필요한 탭(마켓·스티커)은 각 탭 루트에 `overflow-y-auto` 를 둠.
         * `pb`: 하단 독 높이(60px) + 소량 여유 — 하단 패널과 독 사이 빈 화면을 줄임.
         */}
        {/** 양축 `visible` — 위와 동일 이유로 `hidden`·축 혼합 사용 안 함 */}
        <main className="relative z-10 mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-visible px-4 pb-[calc(60px+0.35rem)] pt-4">
          {children}
        </main>
        {/**
         * 부모 미리보기 모드에서는 Next `Link` 소프트 네비게이션 대신 전체 문서 이동(`<a>`)을 써서
         * HttpOnly 미리보기 쿠키가 항상 포함되도록 합니다(미션 탭에서 부모 홈으로 튕기는 현상 완화).
         */}
        <ChildNavBar isParentPreview={ctx.isParentPreview} />
      </div>
    </ChildAppProfileProvider>
  )
}
