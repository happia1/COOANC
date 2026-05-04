'use client'

/**
 * 다자녀 전환 로직만 제공합니다 (‹ › UI 는 `CompactChildProfileCard` 안의 아바타 양 옆에 붙음).
 *
 * - `selectedChildId`(Zustand)를 바꿔 홈·루틴·승인에서 같은 자녀를 가리키게 유지합니다.
 * - 반환되는 `CompactChildProfileSiblingNav` 를 `CompactChildProfileCard` 의 `siblingNav` 로 넘기면
 *   가로 스와이프와 화살표 탭 모두 같은 규칙으로 동작합니다.
 */

import { useRef, useCallback, type TouchEvent } from 'react'
import { useParentStore } from '@/store/parentStore'
import type { CompactChildProfileSiblingNav } from '@/components/parent/CompactChildProfileCard'

export type ChildTab = { id: string; name: string }

/** UUID 형태일 때만 `selectedChildId` 로 신뢰합니다 */
function looksLikeUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
}

/**
 * 자녀가 2명 이상일 때만 비어 있지 않은 객체를 줍니다.
 * 1명·0명 이면 `undefined` 로 아바타 줄에 화살표도 스와이프도 붙지 않습니다.
 */
export function useChildSiblingAvatarNav(tabs: ChildTab[]): CompactChildProfileSiblingNav | undefined {
  const { selectedChildId, setSelectedChildId } = useParentStore()
  /** 터치 시작 X — 카드 안 아바타 줄에서 스와이프 방향을 잽니다 (`ChildProfileNav` 와 동일 임계값 56px) */
  const touchStartX = useRef<number | null>(null)

  const goSibling = useCallback(
    (delta: number) => {
      if (tabs.length < 2) return
      const current =
        selectedChildId && looksLikeUuid(selectedChildId) && tabs.some((t) => t.id === selectedChildId)
          ? selectedChildId
          : tabs[0].id
      const i = tabs.findIndex((t) => t.id === current)
      if (i < 0) return
      const next = (i + delta + tabs.length) % tabs.length
      setSelectedChildId(tabs[next].id)
    },
    [tabs, selectedChildId, setSelectedChildId],
  )

  const onSwipeTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.targetTouches[0]?.clientX ?? null
  }, [])

  const onSwipeTouchEnd = useCallback(
    (e: TouchEvent) => {
      const start = touchStartX.current
      touchStartX.current = null
      if (start == null) return
      const end = e.changedTouches[0]?.clientX
      if (end == null) return
      const d = end - start
      if (d > 56) goSibling(-1)
      else if (d < -56) goSibling(1)
    },
    [goSibling],
  )

  if (tabs.length < 2) return undefined

  return {
    onPrev: () => goSibling(-1),
    onNext: () => goSibling(1),
    onSwipeTouchStart,
    onSwipeTouchEnd,
  }
}
