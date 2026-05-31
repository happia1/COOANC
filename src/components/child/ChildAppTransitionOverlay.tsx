'use client'

/**
 * 자녀 앱 진입·나가기 전환 시 즉시 덮는 전환 오버레이입니다.
 * 비개발자: 버튼을 누르자마자 배경과 「불러오는 중」 안내가 보여, 다음 화면이 준비될 때까지 기다리는 느낌을 줍니다.
 */

import TabTransitionSkeleton from '@/components/ui/TabTransitionSkeleton'
import { ASSETS, CHILD_HOME_BACKGROUND_CACHE_BUST } from '@/constants/assets'

type Props = {
  statusMessage: string
  /**
   * `child` — 자녀 홈 키즈룸 배경(부모→자녀 진입)
   * `parent` — 부모 앱 그라데이션 배경(자녀→부모 나가기, 이미지 없음)
   */
  background?: 'child' | 'parent'
}

export default function ChildAppTransitionOverlay({
  statusMessage,
  background = 'parent',
}: Props) {
  const childBgSrc = `${ASSETS.layouts.childHomeBackgroundSecondScreen}?v=${CHILD_HOME_BACKGROUND_CACHE_BUST}`

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-stretch justify-center overflow-hidden px-4 py-8 ${
        background === 'parent' ? 'bg-gradient-to-b from-sky-50 via-white to-blue-50' : ''
      }`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={statusMessage}
    >
      {background === 'child' ? (
        <>
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
            <TabTransitionSkeleton statusMessage={statusMessage} />
          </div>
        </>
      ) : (
        <div className="flex h-full w-full flex-1 flex-col justify-center">
          <TabTransitionSkeleton statusMessage={statusMessage} />
        </div>
      )}
    </div>
  )
}
