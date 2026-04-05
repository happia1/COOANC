'use client'

/**
 * 자녀 프로필 슬라이드 네비게이션
 *
 * - 홈·루틴 탭에서 같은 `selectedChildId`(Zustand)를 쓰므로, 화면을 옮겨도 선택한 자녀가 유지됩니다.
 * - 자녀가 2명 이상일 때만 ◀ ▶ 버튼과 좌우 스와이프로 이전/다음 자녀로 넘깁니다.
 * - 자녀가 1명이면 별도 줄(이름 텍스트)은 두지 않습니다. 이름은 아래 프로필 카드에만 표시됩니다.
 */

import { useRef, useCallback } from 'react'
import { useParentStore } from '@/store/parentStore'

export type ChildTab = { id: string; name: string }

type Props = {
  /** 부모에게 연결된 자녀 목록(이름·id) */
  tabs: ChildTab[]
  /** true 이면 여백·버튼을 줄여 카드 안에 넣기 좋게 */
  compact?: boolean
}

/** 간단한 UUID 형태면 true — 잘못된 문자열은 API까지 보내지 않기 위함 */
function looksLikeUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
}

export default function ChildProfileNav({ tabs, compact }: Props) {
  const { selectedChildId, setSelectedChildId } = useParentStore()
  /** 터치 시작 X 좌표 — 스와이프 방향 판별용 */
  const touchStartX = useRef<number | null>(null)

  const goSibling = useCallback(
    (delta: number) => {
      if (tabs.length < 2) return
      const current = selectedChildId && tabs.some((t) => t.id === selectedChildId) ? selectedChildId : tabs[0].id
      const i = tabs.findIndex((t) => t.id === current)
      if (i < 0) return
      const next = (i + delta + tabs.length) % tabs.length
      setSelectedChildId(tabs[next].id)
    },
    [tabs, selectedChildId, setSelectedChildId],
  )

  if (tabs.length === 0) return null

  const effectiveId =
    selectedChildId && looksLikeUuid(selectedChildId) && tabs.some((t) => t.id === selectedChildId)
      ? selectedChildId
      : tabs[0].id
  const idx = Math.max(0, tabs.findIndex((t) => t.id === effectiveId))
  const current = tabs[idx] ?? tabs[0]

  const btnClass = compact
    ? 'flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-base font-bold text-[#4A90E2] shadow-sm transition-all active:scale-95 hover:bg-[#4A90E2]/5 disabled:opacity-30'
    : 'flex h-9 min-w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-lg font-bold text-[#4A90E2] shadow-sm transition-all active:scale-95 hover:bg-[#4A90E2]/5 disabled:opacity-30'

  // 자녀 1명: 카드에 이미 이름이 있으므로 상단 중복 텍스트는 렌더하지 않음
  if (tabs.length === 1) {
    return null
  }

  return (
    <div
      className={`flex items-stretch justify-between gap-2 px-0.5 ${compact ? 'py-0.5' : 'py-1.5'}`}
      onTouchStart={(e) => {
        touchStartX.current = e.targetTouches[0]?.clientX ?? null
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current
        touchStartX.current = null
        if (start == null) return
        const end = e.changedTouches[0]?.clientX
        if (end == null) return
        const d = end - start
        if (d > 56) goSibling(-1)
        else if (d < -56) goSibling(1)
      }}
    >
      <button type="button" className={btnClass} aria-label="이전 자녀" onClick={() => goSibling(-1)}>
        ‹
      </button>
      {/* 이름은 아래 프로필 카드에 있으므로, 여기서는 몇 번째 자녀인지만 표시 */}
      <div className="min-w-0 flex-1 flex flex-col items-center justify-center px-1">
        <p className="text-[10px] font-bold tabular-nums text-gray-400" aria-label={`${current.name}, ${idx + 1}번째 자녀`}>
          {idx + 1} / {tabs.length}
        </p>
      </div>
      <button type="button" className={btnClass} aria-label="다음 자녀" onClick={() => goSibling(1)}>
        ›
      </button>
    </div>
  )
}
