'use client'

import Image from 'next/image'
import Link from 'next/link'
import { TOPBAR_LOGO_CLASSNAME, TOPBAR_LOGO_HEIGHT, TOPBAR_LOGO_SRC, TOPBAR_LOGO_WIDTH } from '@/constants/branding'
import ParentRoutineAlarmButton from '@/components/parent/ParentRoutineAlarmButton'

type TopBarProps = {
  /** 가족 연결 자녀 기준 구매 승인 대기 건수 — 종 게시판·흔들림에만 사용 (별도 공지 버튼 없음) */
  pendingApprovalCount: number
}

/**
 * 부모 앱 공통 상단바
 * - 좌: 앱 파비콘과 동일한 마크(브라우저 탭 아이콘과 같은 이미지)
 * - 우: 종(알림·공지) + 알람시계(루틴 알람 바로가기) + 설정
 */
export default function ParentTopBar({ pendingApprovalCount }: TopBarProps) {
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
        <div className="flex items-center gap-2">
          <ParentRoutineAlarmButton initialPendingApprovalCount={pendingApprovalCount} />
          <Link
            href="/settings"
            prefetch={false}
            className="flex h-8 w-8 items-center justify-center transition-opacity hover:opacity-80"
            aria-label="설정"
          >
            <Image src="/assets/img/common/ui/setting.png" alt="" width={20} height={20} className="h-5 w-5 object-contain" />
          </Link>
        </div>
      </div>
    </header>
  )
}
