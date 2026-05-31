/**
 * 자녀 앱(`(child)` 세그먼트, 주로 `/home`) 전환 시 잠깐 보이는 로딩 UI 입니다.
 *
 * 비개발자 설명:
 * - 부모→자녀 진입 중에는 루트 `ChildEnterTransitionProvider` 오버레이(z-200)가 위를 덮습니다.
 * - 이 스켈레톤은 직접 `/home` 접속 등 다른 경로용입니다.
 */

import TabTransitionSkeleton from '@/components/ui/TabTransitionSkeleton'
import { ASSETS, CHILD_HOME_BACKGROUND_CACHE_BUST } from '@/constants/assets'

export default function ChildSegmentLoading() {
  const childBgSrc = `${ASSETS.layouts.childHomeBackgroundSecondScreen}?v=${CHILD_HOME_BACKGROUND_CACHE_BUST}`

  return (
    <div className="relative flex min-h-dvh w-full flex-col items-stretch justify-center overflow-hidden px-4 py-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={childBgSrc}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover brightness-[1.1]"
        draggable={false}
        fetchPriority="high"
        loading="eager"
        decoding="async"
      />
      <div className="relative z-10 flex w-full flex-1 flex-col justify-center">
        <TabTransitionSkeleton statusMessage="자녀 화면을 불러오는 중…" />
      </div>
    </div>
  )
}
