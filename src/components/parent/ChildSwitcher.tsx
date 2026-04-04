'use client'

import { useEffect } from 'react'
import { useParentStore } from '@/store/parentStore'

export type ChildTab = { id: string; name: string }

type Props = {
  children: ChildTab[]
}

/**
 * 자녀 전환 탭 — 자녀 1명이면 렌더링 안 함
 * Zustand selectedChildId 공유 (홈·루틴 탭 연동)
 */
export default function ChildSwitcher({ children }: Props) {
  const { selectedChildId, setSelectedChildId } = useParentStore()

  // 초기 자동 선택
  useEffect(() => {
    if (!selectedChildId && children.length > 0) {
      setSelectedChildId(children[0].id)
    }
  }, [children, selectedChildId, setSelectedChildId])

  // 자녀 1명이면 탭 숨김
  if (children.length <= 1) return null

  const currentId = selectedChildId ?? children[0]?.id

  return (
    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
      {children.map((child) => {
        const isActive = child.id === currentId
        return (
          <button
            key={child.id}
            onClick={() => setSelectedChildId(child.id)}
            className={[
              'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-bold transition-all',
              isActive
                ? 'bg-[#4A90E2] text-white shadow-md'
                : 'bg-white text-gray-400 border border-gray-200',
            ].join(' ')}
          >
            {child.name}
          </button>
        )
      })}
    </div>
  )
}
