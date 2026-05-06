/**
 * 루트 `app` 레벨에서 라우트가 준비되기 전 잠깐 보이는 로딩 UI 입니다.
 *
 * 비개발자 설명:
 * - 로그인·온보딩 등 상위 전환에서 쓰이며, 탭 전환용은 `(child)/loading`, `parent/loading` 이 담당합니다.
 * - 배경 이미지를 깔지 않고 스켈레톤만 두어 화면이 덜 번쩍입니다.
 * - 예전에는 `/` 페이지에만 토끼 로더가 있었고, 현재 `/`는 서버에서 바로 역할별 경로로 보냅니다.
 */

import TabTransitionSkeleton from '@/components/ui/TabTransitionSkeleton'

export default function RootLoading() {
  return (
    <div className="flex min-h-[50vh] w-full flex-col items-stretch justify-start px-4 pt-6">
      <TabTransitionSkeleton />
    </div>
  )
}
