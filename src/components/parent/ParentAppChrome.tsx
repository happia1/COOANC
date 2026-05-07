'use client'

import type { ReactNode } from 'react'
import { Suspense, useCallback, useState } from 'react'
import { usePathname } from 'next/navigation'
import { PARENT_TABS_MAIN_SCROLL_EL_ID } from '@/lib/parentTabsMainScrollId'
import ParentNavBar from '@/components/parent/ParentNavBar'
import ParentTopBar from '@/components/parent/ParentTopBar'
import ParentNewPurchaseRequestModal from '@/components/parent/ParentNewPurchaseRequestModal'
import ParentStickerBoardCompleteModal from '@/components/parent/ParentStickerBoardCompleteModal'
import ParentSettingsSheet from '@/components/parent/ParentSettingsSheet'
import ParentSettingsDeepLink from '@/components/parent/ParentSettingsDeepLink'

type Props = {
  /**
   * 상단바(종·알람)에 넘기는 「구매 승인 대기」 건수입니다.
   * 비개발자 설명: 아이가 마켓에서 부모 승인이 필요한 물건을 담으면 숫자가 올라가고, 이 숫자가 상단 종 옆 표시에 쓰입니다.
   */
  pendingApprovalCount: number
  /** 현재 주소에 맞는 페이지 내용(홈·루틴·승인 등) — 서버에서 그려 온 뒤 이 껍데기 안에 들어갑니다 */
  children: ReactNode
}

/**
 * 부모 앱의 **공통 껍데기**(상단 로고·종·설정 + 본문 + 하단 탭)입니다.
 *
 * 왜 클라이언트 컴포넌트인가요?
 * - 지금 주소가 `/parent` 인지 `/parent/home` 인지 구분하려면 `usePathname()` 이 필요합니다.
 *
 * 왜 `/parent` 에서는 껍데기를 빼나요?
 * - `/parent` 는 곧바로 `/parent/home` 으로 보내는 **짧은 진입 주소**일 뿐이라,
 *   상단·하단 바가 잠깐 보였다 사라지는 깜빡임을 막기 위함입니다.
 * - (예전 구조에서는 `page.tsx` 가 `(tabs)` 폴더 밖에 있어서 레이아웃이 자동으로 안 붙었습니다.)
 */
export default function ParentAppChrome({ pendingApprovalCount, children }: Props) {
  const pathname = usePathname()
  /** 끝의 `/` 를 없애서 `/parent` 와 `/parent/` 를 같은 것으로 봅니다 */
  const normalized = (pathname.replace(/\/$/, '') || '/')

  const [settingsOpen, setSettingsOpen] = useState(false)
  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  if (normalized === '/parent') {
    /** 진입 전용: 리다이렉트 페이지만 그대로 보여 줍니다 */
    return <>{children}</>
  }

  return (
    <div className="flex h-screen flex-col bg-gradient-to-b from-sky-50 via-white to-blue-50">
      <Suspense fallback={null}>
        <ParentSettingsDeepLink onOpenSettings={openSettings} />
      </Suspense>
      <ParentTopBar pendingApprovalCount={pendingApprovalCount} onOpenSettings={openSettings} />
      {/* 모바일: flex-col(하단 독바 fixed) / md+: flex-row(좌측 사이드 독바 + 본문) */}
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <ParentNavBar />
        <main
          id={PARENT_TABS_MAIN_SCROLL_EL_ID}
          className="w-full flex-1 overflow-y-auto pb-16 md:pb-0"
        >
          {children}
        </main>
      </div>
      <ParentNewPurchaseRequestModal />
      <ParentStickerBoardCompleteModal />
      <ParentSettingsSheet open={settingsOpen} onClose={closeSettings} />
    </div>
  )
}
