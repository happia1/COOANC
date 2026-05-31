'use client'

/**
 * 자녀 앱 전환 로딩 UI — 부모→자녀 진입 중에는 루트 전역 오버레이가 이미 덮고 있으므로
 * 중복 스켈레톤을 그리지 않습니다.
 */

import TabTransitionSkeleton from '@/components/ui/TabTransitionSkeleton'
import { ASSETS, CHILD_HOME_BACKGROUND_CACHE_BUST } from '@/constants/assets'
import { useChildEnterTransition } from '@/components/child/ChildEnterTransitionProvider'

export default function ChildSegmentLoading() {
  const { active } = useChildEnterTransition()

  if (active) {
    return null
  }

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
