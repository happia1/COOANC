'use client'

/**
 * 부모 루틴 탭 — 가로 미션 카드 줄에서 드래그로 순서를 바꿉니다.
 * - 데스크톱: 카드를 조금 끌면 순서 변경
 * - 모바일: 카드를 길게 누른 뒤 옆으로 밀면 순서 변경(짧게 스와이프는 가로 스크롤)
 */

import { useEffect, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
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

/** useSortable listeners 타입 — @dnd-kit 버전별 export 이름 차이를 피합니다 */
type MissionStripDragListeners = ReturnType<typeof useSortable>['listeners']

/** 카드 루트에 붙일 드래그·정렬 바인딩 — renderCard 두 번째 인자 */
export type MissionStripDragProps = {
  setNodeRef: (element: HTMLElement | null) => void
  style: CSSProperties
  attributes: DraggableAttributes
  listeners: MissionStripDragListeners
  isDragging: boolean
  /** 직전에 드래그로 순서를 바꿨으면 true — 탭(보상 편집) 열림을 막을 때 씁니다 */
  suppressNextClick: () => boolean
}

type SortableLiProps = {
  id: string
  suppressNextClickRef: MutableRefObject<boolean>
  children: (drag: MissionStripDragProps) => ReactNode
}

/** 길게 누르기 후 드래그(TouchSensor) — RoutineTab LONG_PRESS_MS 와 맞춤 */
const TOUCH_DRAG_DELAY_MS = 250
const TOUCH_DRAG_TOLERANCE_PX = 8
const MOUSE_DRAG_DISTANCE_PX = 8

/** 텍스트 길게 눌러 선택·콜아웃이 뜨지 않게 */
const MISSION_CARD_DRAG_SURFACE_CLASS =
  'select-none [-webkit-user-select:none] [-webkit-touch-callout:none] [touch-action:manipulation]'

function SortableStripItem({ id, children, suppressNextClickRef }: SortableLiProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.92 : 1,
    zIndex: isDragging ? 2 : undefined,
  }

  const drag: MissionStripDragProps = {
    setNodeRef,
    style,
    attributes,
    listeners,
    isDragging,
    suppressNextClick: () => {
      if (!suppressNextClickRef.current) return false
      suppressNextClickRef.current = false
      return true
    },
  }

  return (
    <li className="w-[min(25vw,88px)] shrink-0 snap-start py-px">
      {children(drag)}
    </li>
  )
}

export type SortableStripProps = {
  /** 순서를 저장할 자녀 — 없으면 드래그 없이 기존처럼만 표시합니다 */
  childId: string | null
  missions: Mission[]
  emptyHint: string
  renderCard: (mission: Mission, drag: MissionStripDragProps | null) => ReactNode
  onReorderError?: (message: string) => void
}

export default function SortableHorizontalMissionStrip({
  childId,
  missions,
  emptyHint,
  renderCard,
  onReorderError,
}: SortableStripProps) {
  const router = useRouter()
  const [items, setItems] = useState<Mission[]>(missions)
  const suppressNextClickRef = useRef(false)
  /**
   * @dnd-kit 은 `aria-describedby="DndDescribedBy-N"` id 를 전역 카운터로 만들어,
   * 서버 렌더와 클라이언트 렌더의 번호가 어긋나면 hydration mismatch 가 납니다
   * (특히 DndContext 가 여러 개일 때). 마운트 후에만 드래그 UI 를 켜서 SSR 에는 dnd-kit 을 렌더하지 않습니다.
   */
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setItems(missions)
  }, [missions])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: MOUSE_DRAG_DISTANCE_PX } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: TOUCH_DRAG_DELAY_MS, tolerance: TOUCH_DRAG_TOLERANCE_PX },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const ids = items.map((m) => m.id)

  if (!childId || items.length === 0 || !mounted) {
    if (items.length === 0) {
      return <p className="px-3 py-3 text-center text-[10px] font-normal leading-snug text-gray-400">{emptyHint}</p>
    }
    return (
      <div className="-mx-1 overflow-x-auto pb-0.5 [scrollbar-width:thin] [touch-action:pan-x]">
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
    suppressNextClickRef.current = true
    void persistOrder(next)
  }

  return (
    <div className="-mx-1 overflow-x-auto pb-0.5 [scrollbar-width:thin] [touch-action:pan-x]">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
          <ul className="m-0 flex w-max min-w-full list-none snap-x snap-mandatory gap-0.5 px-1.5 pb-1 pt-1">
            {items.map((m) => (
              <SortableStripItem key={m.id} id={m.id} suppressNextClickRef={suppressNextClickRef}>
                {(drag) => renderCard(m, drag)}
              </SortableStripItem>
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  )
}

/** RoutineTab 카드 루트에 공통으로 붙일 클래스 */
export { MISSION_CARD_DRAG_SURFACE_CLASS }
