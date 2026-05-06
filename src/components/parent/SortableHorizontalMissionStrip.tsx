'use client'

/**
 * 부모 루틴 탭 — 가로 미션 카드 줄에서 드래그로 순서를 바꿉니다.
 * 비개발자 요약: 카드 자체를 길게 눌러 옆으로 밀면 순서가 저장되고, 자녀 앱 미션 줄도 같은 순서를 따릅니다.
 */

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Mission } from '@/types/database'

type SortableLiProps = {
  id: string
  children: (dragHandle: ReactNode | null) => ReactNode
}

/**
 * 한 장의 카드를 드래그 가능하게 감쌉니다.
 * 요청에 따라 중앙 손잡이 아이콘은 제거하고, 카드 영역 자체로 드래그합니다.
 */
function SortableStripItem({ id, children }: SortableLiProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.92 : 1,
    zIndex: isDragging ? 2 : undefined,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="w-[min(25vw,88px)] shrink-0 snap-start py-px"
      {...attributes}
      {...listeners}
    >
      {children(null)}
    </li>
  )
}

export type SortableStripProps = {
  /** 순서를 저장할 자녀 — 없으면 드래그 없이 기존처럼만 표시합니다 */
  childId: string | null
  missions: Mission[]
  emptyHint: string
  /** 카드 본문을 그립니다. (현재는 손잡이 UI를 쓰지 않아 두 번째 인자는 null) */
  renderCard: (mission: Mission, dragHandle: ReactNode | null) => ReactNode
  /** 저장 실패 시 부모 토스트 등에 넘깁니다 */
  onReorderError?: (message: string) => void
}

/**
 * 가로 스크롤 미션 줄 — `missions` 순서가 바뀌면 DB `sort_order` 와 맞춘 뒤 페이지를 새로고침합니다.
 */
export default function SortableHorizontalMissionStrip({
  childId,
  missions,
  emptyHint,
  renderCard,
  onReorderError,
}: SortableStripProps) {
  const router = useRouter()
  const [items, setItems] = useState<Mission[]>(missions)

  useEffect(() => {
    setItems(missions)
  }, [missions])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const ids = items.map((m) => m.id)

  /** 자녀 미선택이면 예전처럼 드래그 없이 나열합니다 */
  if (!childId || items.length === 0) {
    if (items.length === 0) {
      return <p className={`px-3 py-3 text-center text-[10px] font-normal leading-snug text-gray-400`}>{emptyHint}</p>
    }
    return (
      <div className="-mx-1 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
        <ul className="m-0 flex w-max min-w-full list-none snap-x snap-mandatory gap-0.5 px-1.5 pb-1 pt-1">
          {items.map((m) => (
            <li key={m.id} className="w-[min(25vw,88px)] shrink-0 snap-start py-px">
              {renderCard(m, null)}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  async function persistOrder(next: Mission[]) {
    if (!childId) return
    const cid = childId
    const orderedTemplateIds = next.map((m) => m.id)
    try {
      const res = await fetch('/api/mission/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: cid, orderedTemplateIds }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setItems(missions)
        onReorderError?.(typeof json.error === 'string' ? json.error : '순서를 저장하지 못했어요')
        return
      }
      router.refresh()
    } catch {
      setItems(missions)
      onReorderError?.('네트워크 오류로 순서를 저장하지 못했어요')
    }
  }

  function handleDragEnd(ev: DragEndEvent) {
    const { active, over } = ev
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((m) => m.id === active.id)
    const newIndex = items.findIndex((m) => m.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(items, oldIndex, newIndex)
    setItems(next)
    void persistOrder(next)
  }

  return (
    <div className="-mx-1 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
          <ul className="m-0 flex w-max min-w-full list-none snap-x snap-mandatory gap-0.5 px-1.5 pb-1 pt-1">
            {items.map((m) => (
              <SortableStripItem key={m.id} id={m.id}>
                {(handle) => renderCard(m, handle)}
              </SortableStripItem>
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  )
}
