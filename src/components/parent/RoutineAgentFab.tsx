'use client'

import { TOPBAR_LOGO_SRC } from '@/constants/branding'

type Props = {
  disabled?: boolean
  unreadCount?: number
  onClick: () => void
}

/**
 * 루틴 도우미 FAB(플로팅 버튼) 공통 컴포넌트
 * - 홈/루틴 탭에서 동일한 위치·스타일·접근성 규칙을 사용합니다.
 * - 터치 타깃을 넓히고 텍스트 라벨을 함께 보여 접근성을 높였습니다.
 */
export default function RoutineAgentFab({ disabled = false, unreadCount = 0, onClick }: Props) {
  const safeUnread = unreadCount > 999 ? 999 : Math.max(0, unreadCount)
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom,0px)+10px)] z-[55] flex justify-center md:bottom-6">
      {/**
       * 래퍼는 pointer-events-none 으로 두고, 실제 버튼에만 pointer-events-auto 를 둡니다.
       * 비개발자 설명: 버튼 주변의 빈 영역이 화면 아래 다른 버튼 클릭을 막지 않게 합니다.
       */}
      <div className="pointer-events-none flex w-full max-w-md justify-end px-4 md:max-w-none md:px-8">
        <button
          type="button"
          disabled={disabled}
          onClick={onClick}
          aria-label={
            safeUnread > 0
              ? `루틴 도우미, 새 답장 ${safeUnread}개. 열어서 확인하기`
              : '루틴 도우미 챗봇 열기'
          }
          className="pointer-events-auto relative inline-flex min-h-14 min-w-[8.75rem] items-center gap-2 rounded-full border border-sky-100/90 bg-white px-3 pr-4 text-left shadow-[0_10px_28px_-6px_rgba(59,130,246,0.35),0_4px_14px_-4px_rgba(15,23,42,0.12)] transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 작은 브랜드 마크 */}
          <img src={TOPBAR_LOGO_SRC} alt="" className="h-9 w-9 shrink-0 object-contain" />
          <span className="text-xs font-black leading-tight text-sky-950">
            루틴 도우미
            <span className="block text-[10px] font-semibold text-sky-700">일정 등록 AI</span>
          </span>
          {safeUnread > 0 ? (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black tabular-nums leading-none text-white shadow ring-2 ring-white"
              aria-hidden
            >
              {safeUnread > 99 ? '99+' : safeUnread}
            </span>
          ) : null}
        </button>
      </div>
    </div>
  )
}
