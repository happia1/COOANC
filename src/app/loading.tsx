/**
 * 루트 `app` 레벨에서 라우트가 준비되기 전 잠깐 보이는 로딩 UI 입니다.
 *
 * 비개발자 설명:
 * - 로그인·온보딩 등 상위 전환에서 쓰이며, 탭 전환용은 `(child)/loading`, `parent/loading` 이 담당합니다.
 * - 스켈레톤 + 「불러오는 중…」 문구로 전환 중임을 알립니다.
 */

import TabTransitionSkeleton from '@/components/ui/TabTransitionSkeleton'

export default function RootLoading() {
  return (
    <div className="flex min-h-[50vh] w-full flex-col items-stretch justify-start px-4 pt-6">
      <TabTransitionSkeleton statusMessage="불러오는 중…" />
    </div>
  )
}
