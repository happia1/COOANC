'use client'

/**
 * 자녀 홈 Client 경계 — `ChildScreen` 을 별도 chunk 로 분리해
 * HMR·페이지 chunk 손상 시 전체 홈이 깨지는 것을 줄입니다.
 */

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type ChildScreen from '@/components/child/ChildScreen'

const ChildScreenLazy = dynamic(() => import('@/components/child/ChildScreen'), {
  loading: () => null,
})

export default function ChildHomeScreenClient(props: ComponentProps<typeof ChildScreen>) {
  return <ChildScreenLazy {...props} />
}
