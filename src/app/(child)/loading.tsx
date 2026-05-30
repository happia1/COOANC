/**
 * 자녀 앱(`(child)` 세그먼트, 주로 `/home`) 전환 시 잠깐 보이는 로딩 UI 입니다.
 *
 * 비개발자 설명:
 * - 부모가 「자녀 화면 보기」로 넘어올 때도 같은 스켈레톤이 잠시 보입니다.
 * - 배경은 자녀 홈과 같은 키즈룸 그림을 깔고, 본문은 회색 placeholder + 안내 문구로 표시합니다.
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
