'use client'

/**
 * 부모 앱 로딩 UI — 자녀→부모 나가기 중에는 루트 전역 오버레이가 덮으므로 스켈레톤을 생략합니다.
 */

import TabTransitionSkeleton from '@/components/ui/TabTransitionSkeleton'
import { useChildEnterTransition } from '@/components/child/ChildEnterTransitionProvider'

export default function ParentSegmentLoadingClient() {
  const { parentExitActive } = useChildEnterTransition()

  if (parentExitActive) {
    return null
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <TabTransitionSkeleton statusMessage="화면을 불러오는 중…" />
    </div>
  )
}
