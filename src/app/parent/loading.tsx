/**
 * 부모 앱(`/parent/home` 등) 탭·페이지 전환 시 잠깐 보이는 로딩 UI 입니다.
 *
 * 비개발자 설명:
 * - 부모 화면의 그라데이션·상단바·하단 독은 유지되고, 본문만 스켈레톤으로 바뀝니다.
 * - 별도 풀스크린 배경을 깔지 않아 전환 시 어색한 번쩍임을 줄입니다.
 */

import TabTransitionSkeleton from '@/components/ui/TabTransitionSkeleton'

export default function ParentSegmentLoading() {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <TabTransitionSkeleton />
    </div>
  )
}
