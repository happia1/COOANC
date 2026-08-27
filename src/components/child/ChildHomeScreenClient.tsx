'use client'

/**
 * 자녀 홈 Client 경계 — `ChildScreen` 을 별도 chunk 로 분리해
 * HMR·페이지 chunk 손상 시 전체 홈이 깨지는 것을 줄입니다.
 */

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type ChildScreen from '@/components/child/ChildScreen'
import TabTransitionSkeleton from '@/components/ui/TabTransitionSkeleton'
import { ASSETS, CHILD_HOME_BACKGROUND_CACHE_BUST } from '@/constants/assets'

const CHILD_SCREEN_CHUNK_RELOAD_KEY = 'cooanc:child-screen-chunk-reload'

function isChunkLoadError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const name = 'name' in err ? String(err.name) : ''
  const message = 'message' in err ? String(err.message) : String(err)
  return name === 'ChunkLoadError' || /Loading chunk .* failed/i.test(message)
}

/** dev HMR 후 이전 chunk URL 이 404 일 때 재시도·1회 새로고침 */
function importChildScreenModule(retriesLeft = 2): Promise<typeof import('@/components/child/ChildScreen')> {
  return import(
    /* webpackChunkName: "child-screen" */
    '@/components/child/ChildScreen'
  ).catch((err: unknown) => {
    if (retriesLeft > 0) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(importChildScreenModule(retriesLeft - 1))
        }, 350)
      })
    }

    if (typeof window !== 'undefined' && isChunkLoadError(err)) {
      const reloaded = sessionStorage.getItem(CHILD_SCREEN_CHUNK_RELOAD_KEY)
      if (!reloaded) {
        sessionStorage.setItem(CHILD_SCREEN_CHUNK_RELOAD_KEY, '1')
        window.location.reload()
        return new Promise(() => {})
      }
      sessionStorage.removeItem(CHILD_SCREEN_CHUNK_RELOAD_KEY)
    }

    throw err
  })
}

/**
 * 자녀 홈 화면 파일을 내려받는 동안 보여 주는 화면입니다.
 *
 * 비개발자 설명(신고된 문제):
 *   예전에는 이 구간에 아무것도 그리지 않아서(`loading: () => null`), 앱을 처음 열 때
 *   **아무 안내도 없는 빈 화면**이 잠깐 떴습니다. 인터넷이 느리면 그 시간이 길어져
 *   멈춘 것처럼 보였고, 미션 카드가 사라진 것으로 오해하기 쉬웠습니다.
 *   이제 배경과 함께 「미션 카드를 불러오는 중이에요」를 보여 줍니다.
 */
function ChildScreenBootLoading() {
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
        <TabTransitionSkeleton statusMessage="미션 카드를 불러오는 중이에요" />
      </div>
    </div>
  )
}

const ChildScreenLazy = dynamic(() => importChildScreenModule(), {
  loading: () => <ChildScreenBootLoading />,
})

export default function ChildHomeScreenClient(props: ComponentProps<typeof ChildScreen>) {
  return <ChildScreenLazy {...props} />
}
