'use client'

import Image from 'next/image'
import { useState } from 'react'
import { TOPBAR_LOGO_CLASSNAME, TOPBAR_LOGO_HEIGHT, TOPBAR_LOGO_SRC, TOPBAR_LOGO_WIDTH } from '@/constants/branding'
import ChildAlarmClockPopup from '@/components/child/ChildAlarmClockPopup'

type Props = {
  /**
   * 부모가 자녀 화면을 미리볼 때 true — 나가기는 쿠키를 지우는 API 로 연결합니다.
   * 자녀 본인 로그인이면 false 이고, 나가기는 부모 홈으로만 갑니다.
   */
  isParentPreview?: boolean
}

/**
 * 자녀 앱 공통 상단바
 * - 좌: 앱 파비콘과 동일한 마크(브라우저 탭 아이콘과 같은 이미지)
 * - 우: 알람시계 아이콘 + 나가기(이미지 아이콘)
 */
export default function ChildTopBar({ isParentPreview = false }: Props) {
  /** 시계 아이콘 팝업(뽀모도로/루틴 알람) 열림 상태 */
  const [clockPopupOpen, setClockPopupOpen] = useState(false)
  const exitHref = isParentPreview ? '/api/parent/exit-child-ui' : '/parent/home'

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="flex items-center justify-between max-w-md mx-auto px-4 py-3">
        {/**
         * 탭 파비콘과 같은 그림입니다. 파일은 `/assets/**` 아래에 두어 `next.config` 의 `localPatterns` 와 맞습니다.
         */}
        <Image
          src={TOPBAR_LOGO_SRC}
          alt="COOANC"
          width={TOPBAR_LOGO_WIDTH}
          height={TOPBAR_LOGO_HEIGHT}
          className={TOPBAR_LOGO_CLASSNAME}
          priority
        />
        <div className="flex items-center justify-end gap-2.5 max-w-[min(100%,14rem)]">
          {/**
           * 시계 아이콘을 누르면 2페이지 팝업(뽀모도로/루틴 알람)을 엽니다.
           * - 비개발자용: 화면을 좌우로 밀어 두 페이지를 전환할 수 있습니다.
           */}
          <button
            type="button"
            onClick={() => setClockPopupOpen(true)}
            className="flex h-8 w-8 items-center justify-center shrink-0 transition-opacity hover:opacity-80"
            aria-label="시계 팝업 열기"
          >
            <Image src="/assets/img/common/ui/alarm.png" alt="" width={20} height={20} className="h-5 w-5 object-contain" />
          </button>
          {/**
           * 부모 미리보기 시 `exitHref` 가 `/api/parent/exit-child-ui` 인데,
           * Next `Link` 기본 prefetch 가 이 URL 을 미리 GET 하면 쿠키가 지워지고 307 이 나가
           * 탭 전환 전에 세션이 깨질 수 있습니다. 반드시 끕니다.
           */}
          <button
            type="button"
            onClick={() => { window.location.href = exitHref }}
            className="flex h-8 w-8 items-center justify-center shrink-0 transition-opacity hover:opacity-80"
            aria-label="나가기"
          >
            <Image src="/assets/img/common/ui/exit.png" alt="" width={20} height={20} className="h-5 w-5 object-contain" />
          </button>
        </div>
      </div>
      <ChildAlarmClockPopup open={clockPopupOpen} onClose={() => setClockPopupOpen(false)} />
    </header>
  )
}
