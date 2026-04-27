'use client'

/**
 * 부모 승인 탭 — 자녀 마켓 메뉴 제어
 * - 선택한 자녀에게 보일 store_items 만 토글로 켜고 끕니다.
 * - 상품마다 이 자녀에게만 적용할 크레딧을 바꿀 수 있습니다(덮어쓰기 API).
 * - 「상품 추가하기」로 가족 전용 상품을 새로 넣을 수 있습니다(API).
 * - 추가 시트는 하단 독(z-50)보다 위(z-[60])에 두고, 내용이 길면 스크롤됩니다.
 * - 사진이 없는 기본 상품은 `items/shop/items/*.png` 를 씁니다(자녀 마켓과 같은 규칙).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MarketItemImage from '@/components/common/MarketItemImage'
import { marketFrameKeyForItemId } from '@/lib/marketItemFrame'
import type { StoreItem } from '@/types/database'
import { formatMarketCreditLabel } from '@/lib/applyStoreItemCreditOverrides'
import {
  PARENT_ADD_ITEM_CATEGORY_OPTIONS,
  PARENT_MARKET_MENU_SECTIONS,
  isCategoryExcludedFromMarket,
  parentMarketSectionIdForItem,
} from '@/lib/parentMarketMenuSections'
import { activeFoodSortIndex, isBetaActive } from '@/constants/betaMarketConfig'

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

export default function ParentMarketMenuControl({
  childId,
  storeItems,
  hiddenItemIds,
  familyLinkIdForChild,
  onHiddenChange,
  onItemCreated,
  creditOverrides,
  onCreditOverrideSaved,
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
  /** 크레딧 변경 시트 — 어떤 상품을 고치는지 */
  const [creditEditItem, setCreditEditItem] = useState<StoreItem | null>(null)
  const [creditEditValue, setCreditEditValue] = useState('')
  const [creditEditLoading, setCreditEditLoading] = useState(false)
  const [creditEditErr, setCreditEditErr] = useState<string | null>(null)
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

  /** 자녀 전환 시 열려 있던 크레딧 편집 시트를 닫습니다 */
  useEffect(() => {
    setCreditEditItem(null)
    setCreditEditErr(null)
  }, [childId])

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!addImageFile) {
      setImagePreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(addImageFile)
    setImagePreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [addImageFile])

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
   * - 배치: 펼침일 때만 타일을 그립니다. 2줄 이상이면 열 방향 채움. 접힘이면 상품 줄 전체 숨김.
   */
  const menuSectionsToRender = useMemo(() => {
    /** 간식 외 구역: 마켓 표시(켜짐) 먼저, 그다음 이름순 */
    const sortItemsForSection = (items: StoreItem[]) =>
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
    const sortSnackItems = (items: StoreItem[]) =>
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

    const rows: { sectionKey: string; title: string; items: StoreItem[] }[] = []
    for (const sec of PARENT_MARKET_MENU_SECTIONS) {
      const items = itemsForChild.filter((it) => parentMarketSectionIdForItem(it.category) === sec.id)
      if (items.length > 0) {
        const sorted =
          sec.id === 'snack' ? sortSnackItems(items) : sortItemsForSection(items)
        rows.push({ sectionKey: sec.id, title: sec.title, items: sorted })
      }
    }
    const other = itemsForChild.filter((it) => parentMarketSectionIdForItem(it.category) === 'other')
    if (other.length > 0) {
      rows.push({ sectionKey: 'other', title: '기타', items: sortItemsForSection(other) })
    }
    return rows
  }, [itemsForChild, hiddenItemIds])

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

  /** 크레딧 편집 시트 열기 — 입력칸에 현재 적용가를 넣습니다 */
  function openCreditEdit(it: StoreItem) {
    setCreditEditErr(null)
    setCreditEditItem(it)
    setCreditEditValue(String(effectiveCreditPrice(it)))
  }

  /** 시트에서 저장 — API 가 기본가와 같으면 덮어쓰기 행을 지웁니다 */
  async function submitCreditEdit() {
    if (!childId || !creditEditItem) return
    const v = Math.floor(Number(creditEditValue))
    if (!Number.isFinite(v) || v < 0 || v > 999_999) {
      setCreditEditErr('0~999999 사이 숫자로 입력해 주세요')
      return
    }
    setCreditEditErr(null)
    setCreditEditLoading(true)
    try {
      const res = await fetch('/api/market/child-item-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId, storeItemId: creditEditItem.id, creditPrice: v }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCreditEditErr(typeof json.error === 'string' ? json.error : '저장하지 못했어요')
        return
      }
      const usedOverride = json.usedOverride === true
      const nextPrice = typeof json.creditPrice === 'number' ? json.creditPrice : v
      onCreditOverrideSaved(creditEditItem.id, usedOverride ? nextPrice : null)
      setCreditEditItem(null)
    } catch {
      setCreditEditErr('네트워크 오류가 났어요')
    } finally {
      setCreditEditLoading(false)
    }
  }

  /** 한 칸(썸네일·이름·크레딧·토글) — 가로 스크롤 줄에서 재사용합니다. */
  function renderMenuItemTile(it: StoreItem) {
    const hidden = hiddenItemIds.has(it.id)
    const visible = !hidden
    const spriteFrame = marketFrameKeyForItemId(it.id, it.name)
    const price = effectiveCreditPrice(it)
    const hasOverride = creditOverrides[it.id] !== undefined
    /**
     * 베타에서 허용 목록 외 상품 → 흐리게 + 「준비중」 오버레이 표시
     * 기능 자체(토글·크레딧 수정)는 살아있어 미리 설정해 둘 수 있습니다.
     */
    const isBeta = isBetaActive(it.name, it.category ?? '')
    const isBlocked = !isBeta

    return (
      <div key={it.id} className="relative flex min-w-0 snap-start flex-col items-center gap-0.5">
        {/* 베타 미포함 상품: 흐리게 처리 */}
        <div className={isBlocked ? 'opacity-40 grayscale pointer-events-none' : ''}>
          {/** 이미지 블록 가로를 줄여 한 화면에 더 많은 칸이 들어가게 합니다. */}
          <div className="flex h-12 w-full max-w-[3.25rem] items-center justify-center overflow-hidden rounded-lg bg-gray-50 ring-1 ring-gray-100 sm:max-w-[3.5rem]">
            {it.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={it.image_url}
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
            title={it.name}
          >
            {it.name}
          </p>
          {/** 이 자녀 기준 실제 가격 + 탭하면 숫자를 바꿀 수 있음 */}
          <button
            type="button"
            onClick={() => openCreditEdit(it)}
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

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f && f.size > 0) {
      setAddImageFile(f)
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
            className="shrink-0 text-[11px] font-bold text-gray-400 underline-offset-2 hover:text-gray-500 hover:underline disabled:opacity-30"
          >
            상품 추가하기
          </button>
        </div>
      </div>
      <p className="mb-3 text-[11px] leading-snug text-gray-400">
        자녀의 마켓에 올라갈 상품을 구성해보세요.
      </p>

      {toggleSaveErr && (
        <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-[11px] font-bold text-red-600 ring-1 ring-red-100" role="alert">
          {toggleSaveErr}
        </p>
      )}

      {!childId ? (
        <div className="rounded-2xl bg-white p-6 text-center text-sm text-gray-400 shadow-sm">자녀를 연결해 주세요</div>
      ) : itemsForChild.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center text-sm text-gray-400 shadow-sm">
          표시할 상품이 없어요. 상품 추가하기로 넣을 수 있어요.
        </div>
      ) : (
        <div className="space-y-6 rounded-2xl bg-white p-3 shadow-sm">
          {menuSectionsToRender.map((block) => {
            /** 접힘이면 상품 타일(첫 줄 포함)을 아예 그리지 않습니다. */
            const expanded = menuSectionExpanded[block.sectionKey] === true
            /** 펼쳤을 때만 2줄 그리드 — 상품이 1개면 1줄 */
            const useTwoRows = block.items.length > 1

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
                    {/* 장난감·이벤트 구역은 베타에서 준비중 배지 표시 */}
                    {(block.sectionKey === 'toy' || block.sectionKey === 'event') && (
                      <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-px text-[8px] font-bold text-gray-400">
                        준비중
                      </span>
                    )}
                  </div>
                  <span
                    aria-hidden
                    className={`shrink-0 text-sm font-bold leading-none text-gray-400 transition-transform duration-200 ${
                      expanded ? 'rotate-180' : ''
                    }`}
                  >
                    ▼
                  </span>
                </button>
                {/**
                 * 접힘: 첫 줄 포함 **아무 타일도 안 보임**. 펼침: 2개 이상이면 2줄 그리드 + 가로 스크롤.
                 */}
                {expanded ? (
                  <div className="-mx-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden pb-1 pt-1 [scrollbar-width:thin] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-1">
                    <div
                      className={`grid w-max grid-flow-col gap-x-1.5 gap-y-2.5 px-1 auto-cols-[minmax(3.25rem,3.5rem)] sm:auto-cols-[minmax(3.5rem,3.75rem)] ${
                        useTwoRows ? 'grid-rows-2' : 'grid-rows-1'
                      }`}
                    >
                      {block.items.map((it) => renderMenuItemTile(it))}
                    </div>
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
            className="w-full max-w-md max-h-[min(88dvh,calc(100vh-0.5rem))] overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl"
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
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              capture="environment"
              className="sr-only"
              tabIndex={-1}
              onChange={onPickFile}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              className="sr-only"
              tabIndex={-1}
              onChange={onPickFile}
            />

            <p className="mb-1.5 text-xs font-bold text-gray-600">상품 이미지 (선택)</p>
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700 active:scale-[0.98]"
              >
                카메라로 촬영
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
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

      {creditEditItem && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
          role="presentation"
          onClick={() => setCreditEditItem(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="credit-edit-title"
            className="w-full max-w-md max-h-[min(70dvh,calc(100vh-0.5rem))] overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p id="credit-edit-title" className="mb-1 font-black text-brand-text text-base">
              크레딧 설정
            </p>
            <p className="mb-4 text-xs font-bold text-gray-700">{creditEditItem.name}</p>
            <label className="mb-2 block text-xs font-bold text-gray-600">
              크레딧 수정
              <input
                type="number"
                min={0}
                max={999999}
                value={creditEditValue}
                onChange={(e) => setCreditEditValue(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
            </label>
            {creditEditErr && (
              <p className="mb-3 text-xs font-bold text-red-500" role="alert">
                {creditEditErr}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCreditEditItem(null)}
                className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-bold text-gray-500"
              >
                취소
              </button>
              <button
                type="button"
                disabled={creditEditLoading}
                onClick={() => void submitCreditEdit()}
                className="flex-1 rounded-2xl bg-brand-blue py-3 text-sm font-bold text-white shadow-md disabled:opacity-50"
              >
                {creditEditLoading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
