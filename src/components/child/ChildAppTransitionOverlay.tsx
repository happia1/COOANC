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
   * `child` — 자녀 홈과 같은 키즈룸 배경(부모→자녀 진입)
   * `shared` — 부모·공용 배경(자녀→부모 나가기)
   */
  background?: 'child' | 'shared'
}

export default function ChildAppTransitionOverlay({
  statusMessage,
  background = 'shared',
}: Props) {
  const childBgSrc = `${ASSETS.layouts.childHomeBackgroundSecondScreen}?v=${CHILD_HOME_BACKGROUND_CACHE_BUST}`

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-stretch justify-center overflow-hidden px-4 py-8"
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
        <div
          className="flex h-full w-full flex-col items-stretch justify-center bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${ASSETS.layouts.sharedAppBackground})` }}
        >
          <TabTransitionSkeleton statusMessage={statusMessage} />
        </div>
      )}
    </div>
  )
}
