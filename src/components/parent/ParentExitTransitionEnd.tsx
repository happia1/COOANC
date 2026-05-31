'use client'

/**
 * 부모 앱 본문이 그려진 뒤 자녀→부모 전환 오버레이를 끕니다.
 */

import { useEffect } from 'react'
import { useChildEnterTransition } from '@/components/child/ChildEnterTransitionProvider'

export default function ParentExitTransitionEnd() {
  const { parentExitActive, endParentExit } = useChildEnterTransition()

  useEffect(() => {
    if (!parentExitActive) return
    let outer = 0
    let inner = 0
    outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        endParentExit()
      })
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [parentExitActive, endParentExit])

  return null
}
