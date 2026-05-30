/**
 * 탭 전환·세그먼트 로딩 시 본문 영역에만 보여 주는 가벼운 스켈레톤입니다.
 *
 * 비개발자 설명:
 * - 회색 박스(placeholder)와 「불러오는 중」 문구로 기다리는 동안 무엇이 일어나는지 알려 줍니다.
 * - 상단·하단 탭(레이아웃)은 그대로 두고 가운데 본문만 스켈레톤으로 바꿉니다.
 */

type Props = {
  /** 막대 아래에 보여 줄 짧은 안내 — 예: 「자녀 화면을 불러오는 중…」 */
  statusMessage?: string
}

export default function TabTransitionSkeleton({
  statusMessage = '불러오는 중…',
}: Props) {
  return (
    <div
      className="flex w-full flex-1 flex-col gap-3 px-0 py-1"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={statusMessage}
    >
      {/* 상단 카드 자리 */}
      <div className="h-28 w-full animate-pulse rounded-2xl bg-gray-200/80" />

      {/* 중간 텍스트·목록 자리 */}
      <div className="flex flex-col gap-2">
        <div className="h-3 w-[60%] max-w-[12rem] animate-pulse rounded-md bg-gray-200/70" />
        <div className="h-3 w-full animate-pulse rounded-md bg-gray-100/90" />
        <div className="h-3 w-[92%] animate-pulse rounded-md bg-gray-100/90" />
      </div>

      {/* 하단 카드 그리드 */}
      <div className="mt-1 grid grid-cols-2 gap-2">
        <div className="h-24 animate-pulse rounded-xl bg-gray-100/90" />
        <div className="h-24 animate-pulse rounded-xl bg-gray-100/90" />
      </div>

      <p className="py-4 text-center text-sm font-semibold text-gray-500">{statusMessage}</p>
    </div>
  )
}
