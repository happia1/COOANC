'use client'

/**
 * 자녀 홈 Client 경계 — `ChildScreen` 을 별도 chunk 로 분리해
 * HMR·페이지 chunk 손상 시 전체 홈이 깨지는 것을 줄입니다.
 */

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type ChildScreen from '@/components/child/ChildScreen'

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

const ChildScreenLazy = dynamic(() => importChildScreenModule(), {
  loading: () => null,
})

export default function ChildHomeScreenClient(props: ComponentProps<typeof ChildScreen>) {
  return <ChildScreenLazy {...props} />
}
