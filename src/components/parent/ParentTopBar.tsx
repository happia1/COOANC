'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { AUTH_LOGO_SRC, TOPBAR_LOGO_CLASSNAME, TOPBAR_LOGO_HEIGHT, TOPBAR_LOGO_WIDTH } from '@/constants/branding'
import ParentRoutineAlarmButton from '@/components/parent/ParentRoutineAlarmButton'
import ParentNoticeSlideSheet from '@/components/parent/ParentNoticeSlideSheet'

/**
 * 부모 앱 공통 상단바
 * - 좌: COOANC 로고
 * - 우: notice + 루틴 알람 + 설정 버튼
 */
export default function ParentTopBar() {
  const [noticeOpen, setNoticeOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="flex items-center justify-between max-w-md mx-auto px-4 py-3">
        <Image
          src={AUTH_LOGO_SRC}
          alt="COOANC"
          width={TOPBAR_LOGO_WIDTH}
          height={TOPBAR_LOGO_HEIGHT}
          className={TOPBAR_LOGO_CLASSNAME}
          priority
        />
        <div className="flex items-center gap-2">
          {/* 주요 공지사항을 여는 notice 슬라이드 팝업 버튼 */}
          <button
            type="button"
            onClick={() => setNoticeOpen(true)}
            className="flex h-8 w-8 items-center justify-center transition-opacity hover:opacity-80"
            aria-label="공지사항 열기"
          >
            <Image src="/assets/img/common/ui/notice.png" alt="" width={20} height={20} className="h-5 w-5 object-contain" />
          </button>
          <ParentRoutineAlarmButton />
          <Link
            href="/settings"
            className="flex h-8 w-8 items-center justify-center transition-opacity hover:opacity-80"
            aria-label="설정"
          >
            {/* 텍스트 버튼 대신 setting 아이콘 사용, 알약 배경 제거 */}
            <Image src="/assets/img/common/ui/setting.png" alt="" width={20} height={20} className="h-5 w-5 object-contain" />
          </Link>
        </div>
      </div>
      <ParentNoticeSlideSheet open={noticeOpen} onClose={() => setNoticeOpen(false)} />
    </header>
  )
}
