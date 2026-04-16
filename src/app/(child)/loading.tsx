/**
 * 자녀 앱(`/home`, `/mission` …) 라우트가 바뀔 때 잠깐 보이는 로딩 UI 입니다.
 *
 * 비개발자 설명:
 * - 상·하단 바(레이아웃)는 그대로 두고, 가운데 본문만 회색 박스 스켈레톤으로 채웁니다.
 * - 전체 화면 배경을 바꾸지 않아 탭을 눌렀을 때 깜빡임이 줄어듭니다.
 * - 토끼 달리기(BunnyRun)는 「앱에 맨 처음 들어올 때」루트(/) 화면에서만 씁니다.
 */

import TabTransitionSkeleton from '@/components/ui/TabTransitionSkeleton'

export default function ChildSegmentLoading() {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <TabTransitionSkeleton />
    </div>
  )
}
