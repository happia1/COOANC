/**
 * 탭 전환·세그먼트 로딩 시 본문 영역에만 보여 주는 가벼운 스켈레톤입니다.
 *
 * 비개발자 설명:
 * - 전체 화면을 덮는 배경 그림 대신, 회색 박스(placeholder)만 잠깐 보여 줍니다.
 * - 실제 데이터가 오면 이 박스들은 사라지고 진짜 콘텐츠로 바뀝니다.
 * - 상단·하단 탭(레이아웃)은 그대로 두고 가운데만 “불러오는 중” 느낌을 냅니다.
 */

export default function TabTransitionSkeleton() {
  return (
    <div
      className="flex w-full flex-1 flex-col gap-3 px-0 py-1"
      role="status"
      aria-busy="true"
      aria-label="화면 불러오는 중"
    >
      {/* 상단 카드 자리 — 둥근 큰 박스 하나 */}
      <div className="h-28 w-full animate-pulse rounded-2xl bg-gray-200/80" />

      {/* 중간 텍스트·목록 자리 — 가로로 긴 줄 여러 개 */}
      <div className="flex flex-col gap-2">
        <div className="h-3 w-[60%] max-w-[12rem] animate-pulse rounded-md bg-gray-200/70" />
        <div className="h-3 w-full animate-pulse rounded-md bg-gray-100/90" />
        <div className="h-3 w-[92%] animate-pulse rounded-md bg-gray-100/90" />
      </div>

      {/* 하단 카드 그리드 느낌 — 작은 박스 두 개 */}
      <div className="mt-1 grid grid-cols-2 gap-2">
        <div className="h-24 animate-pulse rounded-xl bg-gray-100/90" />
        <div className="h-24 animate-pulse rounded-xl bg-gray-100/90" />
      </div>

      {/* 가운데 작은 스피너 — 스켈레톤만으로 부족할 때 시각적 초점 */}
      <div className="flex flex-1 items-center justify-center py-6">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-sky-500"
          aria-hidden
        />
      </div>
    </div>
  )
}
