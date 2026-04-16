'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { TOPBAR_LOGO_CLASSNAME, TOPBAR_LOGO_HEIGHT, TOPBAR_LOGO_SRC, TOPBAR_LOGO_WIDTH } from '@/constants/branding'

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
 * - 우: 현재 시간(시:분) + 알람시계 아이콘 + 나가기(이미지 아이콘)
 */
export default function ChildTopBar({ isParentPreview = false }: Props) {
  /** 현재 시간을 `HH:MM` 형식으로 저장합니다(예: 09:30). */
  const [nowTime, setNowTime] = useState('00:00')

  useEffect(() => {
    /** Date 객체를 받아 자녀 화면용 시간 문자열(`시:분`)로 바꿉니다. */
    const formatTime = (date: Date) =>
      date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })

    /** 첫 진입 직후에도 바로 시간이 보이도록 즉시 1회 갱신합니다. */
    setNowTime(formatTime(new Date()))

    /** 매 1분마다 시간을 갱신해 상단바 시계가 실제 시간과 맞게 유지되도록 합니다. */
    const timer = setInterval(() => {
      setNowTime(formatTime(new Date()))
    }, 60_000)

    return () => clearInterval(timer)
  }, [])

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
          {/** 현재 시간은 글자만 표시하고, 아이콘은 나가기 버튼 옆으로 분리 배치합니다. */}
          <div className="inline-flex items-center text-[13px] font-bold text-slate-700" aria-label={`현재 시간 ${nowTime}`}>
            <span className="tabular-nums">{nowTime}</span>
          </div>
          {/** 부모 상단바와 같은 알람 아이콘을 나가기 아이콘 왼쪽에 나란히 둡니다. */}
          <Image src="/assets/img/common/ui/alarm.png" alt="" width={20} height={20} className="h-5 w-5 shrink-0 object-contain" />
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
    </header>
  )
}
