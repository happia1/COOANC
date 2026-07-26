'use client'
import ParentChevron from '@/components/parent/ParentChevron'

/**
 * 부모 승인 탭 — 자녀 마켓 메뉴 제어
 * - 선택한 자녀에게 보일 store_items 만 토글로 켜고 끕니다.
 * - 상품마다 이 자녀에게만 적용할 크레딧을 바꿀 수 있습니다(덮어쓰기 API).
 * - 「상품 추가하기」로 가족 전용 상품을 새로 넣을 수 있습니다(API).
 * - 추가 시트는 하단 독(z-50)보다 위(z-[60])에 두고, 내용이 길면 스크롤됩니다.
 * - 사진이 없는 기본 상품은 `items/shop/items/*.png` 를 씁니다(자녀 마켓과 같은 규칙).
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from 'react'
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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MISSION_CARD_DRAG_SURFACE_CLASS } from '@/components/parent/SortableHorizontalMissionStrip'
import MarketItemImage from '@/components/common/MarketItemImage'
import { marketFrameKeyForItemId } from '@/lib/marketItemFrame'
import { resolveStoreItemImageUrl } from '@/constants/marketItemImages'
import type { StoreItem } from '@/types/database'
import { formatMarketCreditLabel } from '@/lib/applyStoreItemCreditOverrides'
import {
  PARENT_ADD_ITEM_CATEGORY_OPTIONS,
  PARENT_MARKET_MENU_SECTIONS,
  isCategoryExcludedFromMarket,
  parentMarketSectionIdForItem,
} from '@/lib/parentMarketMenuSections'
import {
  activeContentSortIndex,
  activeFoodSortIndex,
  isBetaActive,
  isParentPreparingMarketItem,
  storeItemDisplayName,
} from '@/constants/betaMarketConfig'
import { isContentZoneUnlocked } from '@/constants/childScreenFeatures'

export type ParentMarketMenuControlProps = {
  childId: string | null
  /** 이 부모가 볼 수 있는 활성 상품(전체 공개 + 본인 가족 전용) */
  storeItems: StoreItem[]
  /** childId → 숨김 처리된 상품 id */
  hiddenItemIds: Set<string>
  /** 선택 자녀에 해당하는 family_links.id — 가족 전용 상품 필터에 사용 */
  familyLinkIdForChild: string | null
  /** 숨김 목록이 바뀔 때(토글 후) */
  onHiddenChange: (next: Set<string>) => void
  /** 가족 전용 상품이 추가되면 목록에 합칩니다 */
  onItemCreated: (item: StoreItem) => void
  /** 자녀별 크레딧 덮어쓰기(없으면 storeItems[].credit_price 가 그대로 적용) */
  creditOverrides: Record<string, number>
  /** 크레딧 저장 성공 시 — null 이면 덮어쓰기 제거(기본가로 복귀) */
  onCreditOverrideSaved: (itemId: string, nextOverride: number | null) => void
  /** 자녀별 상품 표시 순서(item_id -> order_rank) */
  itemOrders: Record<string, number>
  /** 드래그 정렬 저장 성공 시 상위 컴포넌트 상태 동기화 */
  onItemOrderSaved: (nextOrderMap: Record<string, number>) => void
  /** 가족 전용 상품 수정 후 상위 목록 반영 */
  onItemUpdated: (item: StoreItem) => void
  /** 가족 전용 상품 삭제 후 상위 목록 반영 */
  onItemDeleted: (deletedItemId: string) => void
  /** 선택 자녀 레벨 — 콘텐츠 구역은 레벨 8부터 활성 */
  childLevel?: number
}

/** 토글 스위치 — 켜짐=자녀에게 보임, 꺼짐=숨김 */
function VisibilityToggle({
  on,
  disabled,
  onToggle,
  ariaLabel,
}: {
  on: boolean
  disabled?: boolean
  onToggle: () => void
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onToggle}
      /** 요청사항: 온/오프 토글을 기존 대비 절반 크기로 축소 */
      className={`relative mx-auto h-3 w-[22px] shrink-0 rounded-full transition-colors ${
        on ? 'bg-[#7ED321]' : 'bg-gray-300'
      } ${disabled ? 'opacity-40' : 'active:scale-95'}`}
    >
      <span
        className={`absolute top-[1px] h-2.5 w-2.5 rounded-full bg-white shadow transition-transform ${
          on ? 'right-[1px]' : 'left-[1px]'
        }`}
      />
    </button>
  )
}

/** 타일 루트에 붙일 드래그·정렬 바인딩 — renderMenuItemTile 세 번째 인자 */
type TileDragProps = {
  setNodeRef: (element: HTMLElement | null) => void
  style: CSSProperties
  attributes: DraggableAttributes
  listeners: ReturnType<typeof useSortable>['listeners']
  isDragging: boolean
}

/** 한 구역(≥2개) 안에서 타일을 정렬 가능하게 감싸는 래퍼 */
function SortableMenuTile({
  id,
  children,
}: {
  id: string
  children: (drag: TileDragProps) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : undefined,
  }
  return children({ setNodeRef, style, attributes, listeners, isDragging })
}

export default function ParentMarketMenuControl({
  childId,
  storeItems,
  hiddenItemIds,
  familyLinkIdForChild,
  onHiddenChange,
  onItemCreated,
  creditOverrides,
  onCreditOverrideSaved,
  itemOrders,
  onItemOrderSaved,
  onItemUpdated,
  onItemDeleted,
  childLevel = 0,
}: ParentMarketMenuControlProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addPrice, setAddPrice] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addErr, setAddErr] = useState<string | null>(null)
  /** 사용자가 고른 상품 사진(선택) */
  const [addImageFile, setAddImageFile] = useState<File | null>(null)
  /** 미리보기용 blob URL — addImageFile 바뀔 때마다 갱신 후 해제 */
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  /** 새 상품이 들어갈 마켓 구역(DB category) */
  const [addCategory, setAddCategory] = useState<string>('food')
  /** 마켓 보이기/숨기기 토글 API 실패 시 잠깐 보여 줄 메시지 */
  const [toggleSaveErr, setToggleSaveErr] = useState<string | null>(null)
  /** 상품 수정 시트(연필 버튼) */
  const [editItem, setEditItem] = useState<StoreItem | null>(null)
  const [editName, setEditName] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editDeleteLoading, setEditDeleteLoading] = useState(false)
  const [editErr, setEditErr] = useState<string | null>(null)
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [editImagePreviewUrl, setEditImagePreviewUrl] = useState<string | null>(null)
  const [editRemoveImage, setEditRemoveImage] = useState(false)
  /**
   * 구역마다 상품 타일 영역을 **접기/펼치기** 합니다.
   * 디폴트는 **전부 접힘** — 간식·장난감·이벤트(및 기타) **헤더 줄 전체**를 누르면 펼쳐지고, 오른쪽 ▼ 만 보입니다(펼치면 ▲ 방향으로 회전).
   * 자녀 변경 시 전부 접힘으로 리셋합니다.
   */
  const [menuSectionExpanded, setMenuSectionExpanded] = useState<Record<string, boolean>>({})

  /** 선택 자녀가 바뀌면 펼쳐 두었던 구역을 초기화해, 항상 첫 진입은 모두 접힌 상태가 되게 합니다. */
  useEffect(() => {
    setMenuSectionExpanded({})
  }, [childId])

  /** 자녀 전환 시 열려 있던 수정 시트를 닫습니다 */
  useEffect(() => {
    setEditItem(null)
    setEditErr(null)
  }, [childId])

  const addCameraInputRef = useRef<HTMLInputElement>(null)
  const addGalleryInputRef = useRef<HTMLInputElement>(null)
  const editCameraInputRef = useRef<HTMLInputElement>(null)
  const editGalleryInputRef = useRef<HTMLInputElement>(null)

  /**
   * 드래그 정렬 센서 — 미션 카드(SortableHorizontalMissionStrip)와 동일한 설정.
   * - 마우스: 8px 이동하면 드래그 시작(짧은 클릭은 토글·연필 버튼 그대로 동작)
   * - 터치: 250ms 길게 누르면 드래그 시작(짧은 탭·가로 스크롤은 그대로)
   */
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  /**
   * @dnd-kit hydration mismatch 방지 — 마운트 후에만 드래그(DndContext)를 켭니다.
   * (SSR 에서 dnd-kit 의 aria-describedby id 를 렌더하지 않아 서버/클라 번호 어긋남 제거)
   */
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  /** 순서 저장 중 */
  const [orderSaving, setOrderSaving] = useState(false)
  const [orderSaveErr, setOrderSaveErr] = useState<string | null>(null)
  /** 현재 화면에서 쓰는 순서 맵(자녀별) */
  const [itemOrderMap, setItemOrderMap] = useState<Record<string, number>>(itemOrders)

  const itemOrdersSyncKey = useMemo(() => JSON.stringify(itemOrders), [itemOrders])
  useEffect(() => {
    setItemOrderMap(itemOrders)
  }, [itemOrdersSyncKey])

  useEffect(() => {
    if (!addImageFile) {
      setImagePreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(addImageFile)
    setImagePreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [addImageFile])

  useEffect(() => {
    if (!editImageFile) {
      setEditImagePreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(editImageFile)
    setEditImagePreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [editImageFile])

  /** 시트를 닫을 때 선택 이미지도 비웁니다 */
  useEffect(() => {
    if (!addOpen) {
      setAddImageFile(null)
    }
  }, [addOpen])

  /**
   * 현재 자녀 마켓에 둘 상품만(전체 공개 + 이 부모-자녀 전용).
   * 캐릭터 꾸미기(digital) 는 홈 탭 구매용이라 메뉴 제어 목록에서 제외합니다.
   */
  const itemsForChild = useMemo(() => {
    if (!childId) return []
    return storeItems.filter(
      (it) =>
        !isCategoryExcludedFromMarket(it.category) &&
        (it.family_link_id == null || it.family_link_id === familyLinkIdForChild),
    )
  }, [storeItems, childId, familyLinkIdForChild])

  /**
   * 구역별 상품 목록 — 간식 / 장난감 / 이벤트(활동+체험) / 기타 순, 비어 있으면 구역 제목 숨김
   * - 간식: 베타 활성(`activeFood` 순) → 준비중 항목(이름순); 같은 그룹 안에서는 표시 켜진 항목 먼저.
   * - 그 외 구역: 마켓에 켜 둔 항목 먼저, 그다음 꺼진 항목 — 같은 그룹 안에서는 이름 순.
   * - 배치: 펼침일 때만 타일을 그립니다. 2줄일 때는 1줄을 왼→오른 순으로 채운 뒤 2줄로 넘깁니다. 접힘이면 상품 줄 전체 숨김.
   */
  const menuSectionsToRender = useMemo(() => {
    const rankOf = (id: string) => {
      const v = itemOrderMap[id]
      return Number.isFinite(v) ? v : null
    }

    const compareBySavedRank = (a: StoreItem, b: StoreItem): number => {
      const ra = rankOf(a.id)
      const rb = rankOf(b.id)
      if (ra != null && rb != null && ra !== rb) return ra - rb
      if (ra != null && rb == null) return -1
      if (ra == null && rb != null) return 1
      return 0
    }

    /** 간식 외 구역: 마켓 표시(켜짐) 먼저, 그다음 이름순 */
    const fallbackSortForSection = (items: StoreItem[]) =>
      [...items].sort((a, b) => {
        const aOn = !hiddenItemIds.has(a.id)
        const bOn = !hiddenItemIds.has(b.id)
        if (aOn !== bOn) return aOn ? -1 : 1
        return a.name.localeCompare(b.name, 'ko')
      })

    /**
     * 간식(food) 구역: 베타 활성 항목을 `activeFood` 순서대로 앞에 두고,
     * 준비중(비활성) 항목은 뒤에 이름순으로 둡니다.
     * 같은 그룹 안에서는 표시 켜진 항목을 먼저 둡니다.
     */
    const fallbackSortSnackItems = (items: StoreItem[]) =>
      [...items].sort((a, b) => {
        const aBeta = isBetaActive(a.name, a.category ?? '')
        const bBeta = isBetaActive(b.name, b.category ?? '')
        if (aBeta !== bBeta) return aBeta ? -1 : 1
        if (aBeta && bBeta) {
          const ia = activeFoodSortIndex(a.name)
          const ib = activeFoodSortIndex(b.name)
          if (ia !== ib) return ia - ib
        }
        const aOn = !hiddenItemIds.has(a.id)
        const bOn = !hiddenItemIds.has(b.id)
        if (aOn !== bOn) return aOn ? -1 : 1
        return a.name.localeCompare(b.name, 'ko')
      })

    const fallbackSortContentItems = (items: StoreItem[]) =>
      [...items].sort((a, b) => {
        const aBeta = isBetaActive(a.name, a.category ?? '')
        const bBeta = isBetaActive(b.name, b.category ?? '')
        if (aBeta !== bBeta) return aBeta ? -1 : 1
        if (aBeta && bBeta) {
          const ia = activeContentSortIndex(a.name)
          const ib = activeContentSortIndex(b.name)
          if (ia !== ib) return ia - ib
        }
        const aOn = !hiddenItemIds.has(a.id)
        const bOn = !hiddenItemIds.has(b.id)
        if (aOn !== bOn) return aOn ? -1 : 1
        return a.name.localeCompare(b.name, 'ko')
      })

    const sortByManualOrder = (items: StoreItem[], fallbackSorter: (rows: StoreItem[]) => StoreItem[]) => {
      const fallback = fallbackSorter(items)
      return [...fallback].sort((a, b) => {
        const rankCmp = compareBySavedRank(a, b)
        if (rankCmp !== 0) return rankCmp
        return fallback.findIndex((x) => x.id === a.id) - fallback.findIndex((x) => x.id === b.id)
      })
    }

    const rows: { sectionKey: string; title: string; items: StoreItem[] }[] = []
    for (const sec of PARENT_MARKET_MENU_SECTIONS) {
      const items = itemsForChild.filter((it) => parentMarketSectionIdForItem(it.category) === sec.id)
      if (items.length > 0) {
        const sorted =
          sec.id === 'snack'
            ? sortByManualOrder(items, fallbackSortSnackItems)
            : sec.id === 'content'
              ? sortByManualOrder(items, fallbackSortContentItems)
              : sortByManualOrder(items, fallbackSortForSection)
        rows.push({ sectionKey: sec.id, title: sec.title, items: sorted })
      }
    }
    const other = itemsForChild.filter((it) => parentMarketSectionIdForItem(it.category) === 'other')
    if (other.length > 0) {
      rows.push({
        sectionKey: 'other',
        title: '기타',
        items: sortByManualOrder(other, fallbackSortForSection),
      })
    }
    return rows
  }, [itemsForChild, hiddenItemIds, itemOrderMap])

  const toggleHidden = useCallback(
    async (itemId: string, currentlyVisible: boolean) => {
      if (!childId) return
      const previous = new Set(hiddenItemIds)
      const nextHidden = new Set(hiddenItemIds)
      if (currentlyVisible) {
        nextHidden.add(itemId)
      } else {
        nextHidden.delete(itemId)
      }
      onHiddenChange(nextHidden)
      try {
        const res = await fetch('/api/market/child-hidden-item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ childId, itemId, hidden: currentlyVisible }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          onHiddenChange(previous)
          // 서버가 내려준 Postgres/PostgREST 메시지·코드·details 를 붙여 원인 파악이 쉽게 합니다
          const base = typeof json.error === 'string' ? json.error : '저장하지 못했어요'
          const extra: string[] = []
          if (typeof json.code === 'string' && json.code) extra.push(`[${json.code}]`)
          if (typeof json.details === 'string' && json.details) extra.push(json.details)
          if (typeof json.hint === 'string' && json.hint) extra.push(json.hint)
          setToggleSaveErr(extra.length ? `${base} ${extra.join(' ')}` : base)
          window.setTimeout(() => setToggleSaveErr(null), 8000)
        }
      } catch {
        onHiddenChange(previous)
        setToggleSaveErr('네트워크 오류로 저장하지 못했어요')
        window.setTimeout(() => setToggleSaveErr(null), 4000)
      }
    },
    [childId, hiddenItemIds, onHiddenChange],
  )

  /** 이 자녀에게 실제로 적용되는 크레딧(덮어쓰기 우선) */
  function effectiveCreditPrice(it: StoreItem): number {
    const o = creditOverrides[it.id]
    return o !== undefined ? o : it.credit_price
  }

  /** 연필 버튼으로 상품 편집 시트를 엽니다 */
  function openItemEdit(it: StoreItem) {
    setEditErr(null)
    setEditItem(it)
    setEditName(it.name)
    setEditPrice(String(effectiveCreditPrice(it)))
    setEditImageFile(null)
    setEditRemoveImage(false)
  }

  function canEditItemMeta(it: StoreItem): boolean {
    return !!familyLinkIdForChild && it.family_link_id === familyLinkIdForChild
  }

  /** 수정 시트 저장 */
  async function submitItemEdit() {
    if (!childId || !editItem) return
    const v = Math.floor(Number(editPrice))
    if (!Number.isFinite(v) || v < 0 || v > 999_999) {
      setEditErr('0~999999 사이 숫자로 입력해 주세요')
      return
    }
    const nameTrimmed = editName.trim()
    if (!nameTrimmed || nameTrimmed.length > 80) {
      setEditErr('상품 이름을 확인해 주세요')
      return
    }
    setEditErr(null)
    setEditLoading(true)
    try {
      const oldPrice = effectiveCreditPrice(editItem)
      if (oldPrice !== v) {
        const res = await fetch('/api/market/child-item-credit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ childId, storeItemId: editItem.id, creditPrice: v }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          setEditErr(typeof json.error === 'string' ? json.error : '가격을 저장하지 못했어요')
          return
        }
        const usedOverride = json.usedOverride === true
        const nextPrice = typeof json.creditPrice === 'number' ? json.creditPrice : v
        onCreditOverrideSaved(editItem.id, usedOverride ? nextPrice : null)
      }

      const canMeta = canEditItemMeta(editItem)
      const needMetaSave =
        canMeta &&
        (nameTrimmed !== editItem.name || editImageFile != null || editRemoveImage)

      if (needMetaSave) {
        const fd = new FormData()
        fd.append('childId', childId)
        fd.append('storeItemId', editItem.id)
        fd.append('name', nameTrimmed)
        fd.append('removeImage', editRemoveImage ? 'true' : 'false')
        if (editImageFile) fd.append('image', editImageFile)
        const saveRes = await fetch('/api/market/parent-store-item', {
          method: 'PATCH',
          body: fd,
        })
        const saveJson = await saveRes.json().catch(() => ({}))
        if (!saveRes.ok) {
          setEditErr(typeof saveJson.error === 'string' ? saveJson.error : '상품 정보를 저장하지 못했어요')
          return
        }
        if (saveJson.item) onItemUpdated(saveJson.item as StoreItem)
      }

      setEditItem(null)
    } catch {
      setEditErr('네트워크 오류가 났어요')
    } finally {
      setEditLoading(false)
    }
  }

  /** 가족 전용 상품 삭제 */
  async function submitItemDelete() {
    if (!childId || !editItem) return
    if (!canEditItemMeta(editItem)) {
      setEditErr('기본 상품은 삭제할 수 없어요')
      return
    }
    setEditErr(null)
    setEditDeleteLoading(true)
    try {
      const res = await fetch('/api/market/parent-store-item', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId, storeItemId: editItem.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setEditErr(typeof json.error === 'string' ? json.error : '삭제하지 못했어요')
        return
      }
      onItemDeleted(editItem.id)
      setEditItem(null)
    } catch {
      setEditErr('네트워크 오류가 났어요')
    } finally {
      setEditDeleteLoading(false)
    }
  }

  /**
   * 한 칸(썸네일·이름·크레딧·토글) — 기본은 가로 스크롤 타일.
   * - 이벤트 섹션은 요청사항으로 1열 리스트로 따로 렌더링합니다.
   */
  const saveItemOrder = useCallback(
    async (orderedItemIds: string[], nextOrderMap: Record<string, number>) => {
      if (!childId) return
      setOrderSaveErr(null)
      setOrderSaving(true)
      try {
        const res = await fetch('/api/market/child-item-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ childId, orderedItemIds }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          setOrderSaveErr(typeof json.error === 'string' ? json.error : '순서를 저장하지 못했어요')
          return
        }
        onItemOrderSaved(nextOrderMap)
      } catch {
        setOrderSaveErr('네트워크 오류로 순서를 저장하지 못했어요')
      } finally {
        setOrderSaving(false)
      }
    },
    [childId, onItemOrderSaved],
  )

  /** dnd-kit 드래그 종료 → 해당 구역 안에서만 순서 재계산·저장 */
  function handleSectionDragEnd(sectionKey: string, ev: DragEndEvent) {
    const { active, over } = ev
    if (!over || active.id === over.id) return
    onDragReorder(sectionKey, String(active.id), String(over.id))
  }

  function onDragReorder(sectionKey: string, draggedId: string, targetId: string) {
    if (draggedId === targetId) return
    const sectionOrderByKey: Record<string, string[]> = {}
    for (const sec of menuSectionsToRender) {
      sectionOrderByKey[sec.sectionKey] = sec.items.map((x) => x.id)
    }
    const ids = sectionOrderByKey[sectionKey] ?? []
    const from = ids.indexOf(draggedId)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return
    const nextIds = [...ids]
    const [moved] = nextIds.splice(from, 1)
    nextIds.splice(to, 0, moved)
    sectionOrderByKey[sectionKey] = nextIds

    const orderedAll = menuSectionsToRender.flatMap((sec) => sectionOrderByKey[sec.sectionKey] ?? [])
    const nextOrderMap = Object.fromEntries(orderedAll.map((id, idx) => [id, idx]))
    setItemOrderMap((prev) => ({ ...prev, ...nextOrderMap }))
    void saveItemOrder(orderedAll, nextOrderMap)
  }

  function renderMenuItemTile(it: StoreItem, sectionKey: string, drag: TileDragProps | null) {
    const hidden = hiddenItemIds.has(it.id)
    const visible = !hidden
    const spriteFrame = marketFrameKeyForItemId(it.id, it.name)
    const thumbSrc = resolveStoreItemImageUrl(it.name, it.image_url)
    const price = effectiveCreditPrice(it)
    const hasOverride = creditOverrides[it.id] !== undefined
    /**
     * 베타에서 허용 목록 외 상품 → 흐리게 + 「준비중」 오버레이 표시
     * 기능 자체(토글·크레딧 수정)는 살아있어 미리 설정해 둘 수 있습니다.
     */
    const isBeta = isBetaActive(it.name, it.category ?? '')
    const isContentLevelLocked =
      sectionKey === 'content' && !isContentZoneUnlocked(childLevel)
    /**
     * 요청사항:
     * - 이벤트 옆 준비중 표시는 제거 (이벤트 항목은 베타 준비중 처리도 하지 않음)
     * - 장난감은 목록을 노출하고 준비중이라고 표기(타일 오버레이 유지)
     * - 콘텐츠는 자녀 레벨 8 미만이면 준비중
     */
    const isBlocked =
      sectionKey === 'event'
        ? false
        : isContentLevelLocked
          ? true
          : isParentPreparingMarketItem(it.name)
            ? true
            : !isBeta

    return (
      <div
        key={it.id}
        ref={drag?.setNodeRef}
        style={drag?.style}
        {...(drag?.attributes ?? {})}
        {...(drag?.listeners ?? {})}
        className={`relative flex min-w-0 snap-start flex-col items-center gap-0.5 rounded-xl px-0.5 py-0.5 ${
          drag ? MISSION_CARD_DRAG_SURFACE_CLASS : ''
        } ${drag?.isDragging ? 'opacity-55' : ''}`}
      >
        {/* 베타 미포함 상품: 흐리게 처리 */}
        <div className={isBlocked ? 'opacity-40 grayscale' : ''}>
          {/** 이미지 블록 가로를 줄여 한 화면에 더 많은 칸이 들어가게 합니다. */}
          <div className="flex h-12 w-full max-w-[3.25rem] items-center justify-center overflow-hidden rounded-lg bg-gray-50 ring-1 ring-gray-100 sm:max-w-[3.5rem]">
            {thumbSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbSrc}
                alt=""
                className="max-h-[34px] max-w-[34px] object-contain object-center"
                draggable={false}
              />
            ) : (
              <MarketItemImage frame={spriteFrame} height={34} />
            )}
          </div>
          <p
            className="w-full truncate text-center text-[9px] font-bold leading-tight text-gray-700"
            title={storeItemDisplayName(it.name)}
          >
            {storeItemDisplayName(it.name)}
          </p>
          {/** 이 자녀 기준 실제 가격 + 탭하면 숫자를 바꿀 수 있음 */}
          <button
            type="button"
            onClick={() => openItemEdit(it)}
            title={hasOverride ? `기본 ${it.credit_price}크레딧 → 이 자녀만 ${price}` : '크레딧 바꾸기'}
            className="max-w-full truncate rounded-md px-0.5 text-[8px] font-black leading-tight text-brand-blue underline-offset-2 hover:underline"
          >
            {formatMarketCreditLabel(price)}
            {hasOverride ? '·맞춤' : ''}
          </button>
          <VisibilityToggle
            on={visible}
            ariaLabel={visible ? `${it.name} 마켓에서 숨기기` : `${it.name} 마켓에 표시하기`}
            onToggle={() => toggleHidden(it.id, visible)}
          />
        </div>

        {/* 카드 우상단 연필 버튼 */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            openItemEdit(it)
          }}
          className="absolute right-0 top-0 z-[1] flex h-4 w-4 items-center justify-center rounded-full bg-white/90 text-gray-300 shadow-sm ring-1 ring-gray-100 transition active:scale-95 hover:text-gray-400"
          aria-label={`${it.name} 수정`}
        >
          <PencilIcon className="h-2.5 w-2.5" />
        </button>

        {/* 베타 미포함 상품 준비중 오버레이 */}
        {isBlocked && (
          <div className="absolute inset-0 flex items-end justify-center pb-0.5 pointer-events-none">
            <span className="rounded-full bg-black/40 px-1.5 py-px text-[8px] font-bold text-white">
              준비중
            </span>
          </div>
        )}
      </div>
    )
  }

  function onPickAddFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f && f.size > 0) {
      setAddImageFile(f)
    }
  }

  function onPickEditFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f && f.size > 0) {
      setEditImageFile(f)
      setEditRemoveImage(false)
    }
  }

  async function submitAdd() {
    if (!childId) return
    setAddErr(null)
    setAddLoading(true)
    try {
      const fd = new FormData()
      fd.append('childId', childId)
      fd.append('name', addName.trim())
      fd.append('creditPrice', String(Number(addPrice)))
      fd.append('category', addCategory)
      if (addImageFile) {
        fd.append('image', addImageFile)
      }

      const res = await fetch('/api/market/parent-store-item', {
        method: 'POST',
        body: fd,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAddErr(typeof json.error === 'string' ? json.error : '추가하지 못했어요')
        return
      }
      if (json.item) {
        onItemCreated(json.item as StoreItem)
      }
      setAddName('')
      setAddPrice('')
      setAddCategory('food')
      setAddImageFile(null)
      setAddOpen(false)
    } catch {
      setAddErr('네트워크 오류가 났어요')
    } finally {
      setAddLoading(false)
    }
  }

  return (
    <section className="mt-1">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h2 className="text-sm font-bold text-brand-text">메뉴 제어</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!childId}
            onClick={() => {
              setAddErr(null)
              setAddOpen(true)
            }}
            className="shrink-0 rounded-lg border border-[#4A90E2]/40 bg-[#4A90E2]/10 px-3 py-1.5 text-[11px] font-bold text-[#2563EB] shadow-sm transition active:scale-95 hover:bg-[#4A90E2]/15 disabled:opacity-30"
          >
            ＋ 상품 추가하기
          </button>
        </div>
      </div>
      <p className="mb-3 text-[11px] leading-snug text-gray-400">
        자녀의 마켓에 올라가는 상품을 직접 관리할 수 있어요.
      </p>
      <p className="mb-2 text-[11px] font-bold text-gray-400">
        카드를 길게 누른 뒤(마우스는 살짝 끌어서) 옮기면 순서가 바뀌고 자동 저장돼요.
      </p>

      {toggleSaveErr && (
        <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-[11px] font-bold text-red-600 ring-1 ring-red-100" role="alert">
          {toggleSaveErr}
        </p>
      )}
      {orderSaveErr && (
        <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-[11px] font-bold text-red-600 ring-1 ring-red-100" role="alert">
          {orderSaveErr}
        </p>
      )}
      {orderSaving && (
        <p className="mb-2 rounded-xl bg-gray-50 px-3 py-2 text-[11px] font-bold text-gray-500 ring-1 ring-gray-100">
          순서 저장 중...
        </p>
      )}

      {!childId ? (
        <div className="rounded-2xl bg-white p-6 text-center text-sm text-gray-400 shadow-sm">자녀를 연결해 주세요</div>
      ) : itemsForChild.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center text-sm text-gray-400 shadow-sm">
          상품을 추가해주세요.
        </div>
      ) : (
        <div className="space-y-6 rounded-2xl bg-white p-3 shadow-sm">
          {menuSectionsToRender.map((block) => {
            /** 접힘이면 상품 타일(첫 줄 포함)을 아예 그리지 않습니다. */
            const expanded = menuSectionExpanded[block.sectionKey] === true
            /** 펼쳤을 때만 2줄 그리드 — 상품이 1개면 1줄 */
            const useTwoRows = block.items.length > 1
            /** 나열 순서대로 1줄을 먼저 채우고 2줄로 넘길 때 필요한 열 수 */
            const twoRowColumnCount = Math.max(1, Math.ceil(block.items.length / 2))

            return (
              <div key={block.sectionKey}>
                {/**
                 * 구역 헤더 **전체**를 누르면 접기/펼침 — 오른쪽에는 ▼/▲ 만(문구 없음).
                 * 스크린리더용으로 aria-label 은 유지합니다.
                 */}
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-label={expanded ? `${block.title} 구역 접기` : `${block.title} 구역 펼치기`}
                  onClick={() =>
                    setMenuSectionExpanded((prev) => ({
                      ...prev,
                      [block.sectionKey]: !expanded,
                    }))
                  }
                  className="mb-2 flex w-full items-center gap-2 border-b border-gray-100 pb-2 text-left text-xs font-black text-gray-800 transition-colors active:bg-gray-50/80"
                >
                  <div className="flex min-w-0 flex-1 items-baseline gap-x-2">
                    <span className="min-w-0 truncate">{block.title}</span>
                    <span className="shrink-0 text-[9px] font-extralight tabular-nums tracking-tight text-gray-400">
                      {block.items.length}개
                    </span>
                    {/* 요청사항: 이벤트 옆 준비중 배지는 제거, 장난감만 표시 */}
                    {block.sectionKey === 'toy' && (
                      <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-px text-[8px] font-bold text-gray-400">
                        준비중
                      </span>
                    )}
                  </div>
                  <span className="flex shrink-0 items-center text-gray-400" aria-hidden>
                    <ParentChevron open={expanded} />
                  </span>
                </button>
                {/**
                 * 접힘: 첫 줄 포함 **아무 타일도 안 보임**. 펼침: 2개 이상이면 2줄 그리드 + 가로 스크롤.
                 */}
                {expanded ? (
                  <div className="-mx-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden pb-1 pt-1 [scrollbar-width:thin] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-1">
                    {(() => {
                      /** 2개 이상이면 그 구역 안에서만 드래그 정렬(터치·마우스). 마운트 후에만(SSR hydration 방지) */
                      const canSort = block.items.length > 1 && mounted
                      const oneRow =
                        block.sectionKey === 'event' || block.sectionKey === 'content' || !useTwoRows
                      const tiles = block.items.map((it) =>
                        canSort ? (
                          <SortableMenuTile key={it.id} id={it.id}>
                            {(drag) => renderMenuItemTile(it, block.sectionKey, drag)}
                          </SortableMenuTile>
                        ) : (
                          renderMenuItemTile(it, block.sectionKey, null)
                        ),
                      )
                      const grid = oneRow ? (
                        <div className="grid w-max grid-flow-col grid-rows-1 gap-x-1.5 gap-y-2.5 px-1 auto-cols-[minmax(3.25rem,3.5rem)] sm:auto-cols-[minmax(3.5rem,3.75rem)]">
                          {tiles}
                        </div>
                      ) : (
                        <div
                          className="grid w-max grid-rows-2 gap-x-1.5 gap-y-2.5 px-1"
                          style={{
                            gridTemplateColumns: `repeat(${twoRowColumnCount}, minmax(3.25rem, 3.75rem))`,
                          }}
                        >
                          {tiles}
                        </div>
                      )
                      if (!canSort) return grid
                      return (
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={(ev) => handleSectionDragEnd(block.sectionKey, ev)}
                        >
                          <SortableContext
                            items={block.items.map((x) => x.id)}
                            strategy={rectSortingStrategy}
                          >
                            {grid}
                          </SortableContext>
                        </DndContext>
                      )
                    })()}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {addOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
          role="presentation"
          onClick={() => setAddOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-store-item-title"
            className="w-full max-w-none max-h-[min(88dvh,calc(100vh-0.5rem))] overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p id="add-store-item-title" className="mb-1 font-black text-brand-text text-base">
              상품 추가하기
            </p>
            <p className="mb-4 text-[11px] text-gray-400">
              선택한 자녀 마켓에만 보이는 보상 이름·크레딧·사진(선택)을 정해 주세요.
            </p>
            <label className="mb-2 block text-xs font-bold text-gray-600">
              이름
              <input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                maxLength={80}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                placeholder="예: 주말 아이스크림"
              />
            </label>
            <label className="mb-3 block text-xs font-bold text-gray-600">
              크레딧 (0 = 무료)
              <input
                type="number"
                min={0}
                value={addPrice}
                onChange={(e) => setAddPrice(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                placeholder="50"
              />
            </label>
            <label className="mb-3 block text-xs font-bold text-gray-600">
              카테고리
              <select
                value={addCategory}
                onChange={(e) => setAddCategory(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
              >
                {PARENT_ADD_ITEM_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            {/* 숨긴 file input — 모바일에서 capture 로 카메라, 없으면 갤러리·파일 */}
            <input
              ref={addCameraInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              capture="environment"
              className="sr-only"
              tabIndex={-1}
              onChange={onPickAddFile}
            />
            <input
              ref={addGalleryInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              className="sr-only"
              tabIndex={-1}
              onChange={onPickAddFile}
            />

            <p className="mb-1.5 text-xs font-bold text-gray-600">상품 이미지 (선택)</p>
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => addCameraInputRef.current?.click()}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700 active:scale-[0.98]"
              >
                카메라로 촬영
              </button>
              <button
                type="button"
                onClick={() => addGalleryInputRef.current?.click()}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700 active:scale-[0.98]"
              >
                사진·파일 선택
              </button>
              {addImageFile && (
                <button
                  type="button"
                  onClick={() => setAddImageFile(null)}
                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600"
                >
                  이미지 제거
                </button>
              )}
            </div>
            {imagePreviewUrl && (
              <div className="mb-4 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreviewUrl} alt="선택한 상품 미리보기" className="mx-auto max-h-40 w-full object-contain" />
              </div>
            )}

            {addErr && <p className="mb-3 text-xs font-bold text-red-500">{addErr}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-bold text-gray-500"
              >
                취소
              </button>
              <button
                type="button"
                disabled={(() => {
                  if (addLoading || !addName.trim()) return true
                  const n = Number(addPrice)
                  return !Number.isFinite(n) || n < 0 || n > 999_999
                })()}
                onClick={submitAdd}
                className="flex-1 rounded-2xl bg-brand-blue py-3 text-sm font-bold text-white shadow-md disabled:opacity-50"
              >
                {addLoading ? '저장 중...' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editItem && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
          role="presentation"
          onClick={() => setEditItem(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="item-edit-title"
            className="w-full max-w-none max-h-[min(84dvh,calc(100vh-0.5rem))] overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p id="item-edit-title" className="mb-1 font-black text-brand-text text-base">
              상품 수정
            </p>
            <p className="mb-4 text-[11px] text-gray-400">
              가격은 자녀별로 저장되고, 이미지/이름/삭제는 가족 전용 상품에서만 가능합니다.
            </p>
            <label className="mb-3 block text-xs font-bold text-gray-600">
              상품 이름
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={80}
                disabled={!canEditItemMeta(editItem)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm disabled:bg-gray-50 disabled:text-gray-400"
              />
            </label>
            <label className="mb-2 block text-xs font-bold text-gray-600">
              크레딧 수정
              <input
                type="number"
                min={0}
                max={999999}
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
            </label>

            <input
              ref={editCameraInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              capture="environment"
              className="sr-only"
              tabIndex={-1}
              onChange={onPickEditFile}
            />
            <input
              ref={editGalleryInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              className="sr-only"
              tabIndex={-1}
              onChange={onPickEditFile}
            />

            <p className="mb-1.5 mt-3 text-xs font-bold text-gray-600">상품 이미지</p>
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canEditItemMeta(editItem)}
                onClick={() => editCameraInputRef.current?.click()}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700 disabled:opacity-40"
              >
                카메라
              </button>
              <button
                type="button"
                disabled={!canEditItemMeta(editItem)}
                onClick={() => editGalleryInputRef.current?.click()}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700 disabled:opacity-40"
              >
                사진 선택
              </button>
              <button
                type="button"
                disabled={!canEditItemMeta(editItem)}
                onClick={() => {
                  setEditImageFile(null)
                  setEditRemoveImage(true)
                }}
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 disabled:opacity-40"
              >
                이미지 제거
              </button>
            </div>

            {(editImagePreviewUrl || (!editRemoveImage && editItem.image_url)) ? (
              <div className="mb-3 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={editImagePreviewUrl ?? (editItem.image_url as string)}
                  alt="상품 이미지 미리보기"
                  className="mx-auto max-h-40 w-full object-contain"
                />
              </div>
            ) : null}

            {!canEditItemMeta(editItem) && (
              <p className="mb-3 text-[11px] font-bold text-gray-400">
                기본 상품은 가격만 자녀별로 바꿀 수 있어요.
              </p>
            )}

            {editErr && (
              <p className="mb-3 text-xs font-bold text-red-500" role="alert">
                {editErr}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditItem(null)}
                className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-bold text-gray-500"
              >
                취소
              </button>
              <button
                type="button"
                disabled={editLoading || editDeleteLoading}
                onClick={() => void submitItemEdit()}
                className="flex-1 rounded-2xl bg-brand-blue py-3 text-sm font-bold text-white shadow-md disabled:opacity-50"
              >
                {editLoading ? '저장 중...' : '저장'}
              </button>
            </div>
            <button
              type="button"
              disabled={!canEditItemMeta(editItem) || editLoading || editDeleteLoading}
              onClick={() => void submitItemDelete()}
              className="mt-3 w-full rounded-2xl border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-600 disabled:opacity-40"
            >
              {editDeleteLoading ? '삭제 중...' : '상품 삭제'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 20h9" strokeLinecap="round" />
      <path
        d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
