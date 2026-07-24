'use client'

import { useEffect, useState } from 'react'
import { TOPBAR_LOGO_SRC } from '@/constants/branding'

type Props = {
  disabled?: boolean
  unreadCount?: number
  onClick: () => void
}

/** 진입 후 라벨을 보여 주다가 접히기까지 대기 시간(ms) */
const LABEL_EXPAND_MS = 3000
/** 라벨 접힘·버튼 크기 변화 애니메이션 시간(ms) */
const COLLAPSE_TRANSITION_MS = 500

/**
 * 루틴 도우미 FAB(플로팅 버튼) 공통 컴포넌트
 * - 홈/루틴 탭에서 동일한 위치·스타일·접근성 규칙을 사용합니다.
 * - 처음 3초는 라벨(루틴 도우미·일정 등록 AI)을 보여 주고, 이후 원형 로고만 남깁니다.
 */
export default function RoutineAgentFab({ disabled = false, unreadCount = 0, onClick }: Props) {
  const safeUnread = unreadCount > 999 ? 999 : Math.max(0, unreadCount)
  const [labelExpanded, setLabelExpanded] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => setLabelExpanded(false), LABEL_EXPAND_MS)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    /**
     * 화면 **오른쪽 하단**에 고정합니다. (기존에는 max-w-md 를 화면 중앙에 정렬하고
     * 그 안에서 오른쪽에 붙여, 갤럭시 폴드처럼 넓은 화면에서 버튼이 화면 중앙 근처에
     * 뜨는 문제가 있었습니다. 이제 뷰포트 오른쪽 가장자리에 직접 앵커합니다.)
     * 래퍼는 pointer-events-none, 실제 버튼만 pointer-events-auto 로 두어 주변 빈 영역이
     * 아래 다른 버튼 클릭을 막지 않게 합니다.
     */
    <div className="pointer-events-none fixed right-4 md:right-8 bottom-[calc(60px+env(safe-area-inset-bottom,0px)+10px)] z-[55] md:bottom-6">
      <div className="pointer-events-none flex justify-end">
        <button
          type="button"
          disabled={disabled}
          onClick={onClick}
          aria-label={
            safeUnread > 0
              ? `루틴 도우미, 새 답장 ${safeUnread}개. 열어서 확인하기`
              : '루틴 도우미 챗봇 열기'
          }
          className={[
            'pointer-events-auto relative inline-flex items-center justify-center rounded-full border border-sky-100/90 bg-white text-left shadow-[0_10px_28px_-6px_rgba(59,130,246,0.35),0_4px_14px_-4px_rgba(15,23,42,0.12)]',
            'transition-[min-width,width,height,padding,gap] ease-in-out active:scale-[0.97]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2',
            'disabled:pointer-events-none disabled:opacity-40',
            labelExpanded
              ? 'min-h-14 min-w-[8.75rem] gap-2 px-3 pr-4'
              : 'h-14 w-14 min-w-0 gap-0 p-0',
          ].join(' ')}
          style={{ transitionDuration: `${COLLAPSE_TRANSITION_MS}ms` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 작은 브랜드 마크 */}
          <img src={TOPBAR_LOGO_SRC} alt="" className="h-9 w-9 shrink-0 object-contain" />
          <span
            className={[
              'overflow-hidden whitespace-nowrap text-xs font-black leading-tight text-sky-950',
              'transition-[max-width,opacity,margin] ease-in-out',
              labelExpanded ? 'max-w-[7.5rem] opacity-100' : 'max-w-0 opacity-0',
            ].join(' ')}
            style={{ transitionDuration: `${COLLAPSE_TRANSITION_MS}ms` }}
            aria-hidden={!labelExpanded}
          >
            루틴 도우미
            <span className="block text-[10px] font-semibold text-sky-700">일정 등록 AI</span>
          </span>
          {safeUnread > 0 ? (
            <span
              className="absolute left-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 shadow ring-2 ring-white"
              aria-hidden
            />
          ) : null}
        </button>
      </div>
    </div>
  )
}
