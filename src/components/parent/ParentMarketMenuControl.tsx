'use client'

/**
 * 부모 승인 탭 — 자녀 마켓 메뉴 제어
 * - 선택한 자녀에게 보일 store_items 만 토글로 켜고 끕니다.
 * - 「상품 추가하기」로 가족 전용 상품을 새로 넣을 수 있습니다(API).
 * - 추가 시트는 하단 독(z-50)보다 위(z-[60])에 두고, 내용이 길면 스크롤됩니다.
 * - 사진이 없는 기본 상품은 `items/shop/items/*.png` 를 씁니다(자녀 마켓과 같은 규칙).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MarketItemImage from '@/components/common/MarketItemImage'
import { marketFrameKeyForItemId } from '@/lib/marketItemFrame'
import type { StoreItem } from '@/types/database'
import {
  PARENT_ADD_ITEM_CATEGORY_OPTIONS,
  PARENT_MARKET_MENU_SECTIONS,
  isCategoryExcludedFromMarket,
  parentMarketSectionIdForItem,
} from '@/lib/parentMarketMenuSections'

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
  /** 메뉴 제어 탭 전체 초기화(숨김 목록/DB/목록 재로딩)를 요청합니다 */
  onResetMenu?: () => Promise<void>
  /** 가족 전용 상품이 추가되면 목록에 합칩니다 */
  onItemCreated: (item: StoreItem) => void
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
  onResetMenu,
  onItemCreated,
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
  const [resetLoading, setResetLoading] = useState(false)

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
   * 간식 / 장난감 / 이벤트(활동+체험) / 기타 순으로 묶은 목록
   * — 비어 있는 구역은 제목 자체를 숨깁니다.
   */
  const menuSectionsToRender = useMemo(() => {
    const rows: { sectionKey: string; title: string; items: StoreItem[] }[] = []
    for (const sec of PARENT_MARKET_MENU_SECTIONS) {
      const items = itemsForChild.filter((it) => parentMarketSectionIdForItem(it.category) === sec.id)
      if (items.length > 0) {
        rows.push({ sectionKey: sec.id, title: sec.title, items })
      }
    }
    const other = itemsForChild.filter((it) => parentMarketSectionIdForItem(it.category) === 'other')
    if (other.length > 0) {
      rows.push({ sectionKey: 'other', title: '기타', items: other })
    }
    return rows
  }, [itemsForChild])

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
          {onResetMenu && (
            <button
              type="button"
              disabled={!childId || resetLoading}
              onClick={async () => {
                if (!childId) return
                setToggleSaveErr(null)
                if (!confirm('메뉴 제어를 모두 초기화하고(전체 표시) 다시 불러올까요?')) return
                setResetLoading(true)
                try {
                  setAddOpen(false)
                  setAddErr(null)
                  await onResetMenu()
                } catch (e) {
                  const msg = e instanceof Error ? e.message : '초기화에 실패했어요'
                  setToggleSaveErr(msg)
                } finally {
                  setResetLoading(false)
                }
              }}
              className="shrink-0 text-[11px] font-bold text-gray-400 underline-offset-2 hover:text-gray-500 hover:underline disabled:opacity-30"
            >
              {resetLoading ? '초기화 중...' : '초기화'}
            </button>
          )}
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
          {menuSectionsToRender.map((block) => (
            <div key={block.sectionKey}>
              <h3 className="mb-2 flex items-center gap-1.5 border-b border-gray-100 pb-2 text-xs font-black text-gray-800">
                {block.title}
                <span className="ml-auto tabular-nums text-[10px] font-bold text-gray-400">{block.items.length}개</span>
              </h3>
              <div className="grid grid-cols-5 gap-x-1 gap-y-3 pt-1">
                {block.items.map((it) => {
                  const hidden = hiddenItemIds.has(it.id)
                  const visible = !hidden
                  // 자녀 마켓(MarketTab)과 동일: id·이름으로 항상 같은 PNG 가 나오게 함
                  const spriteFrame = marketFrameKeyForItemId(it.id, it.name)
                  return (
                    <div key={it.id} className="flex min-w-0 flex-col items-center gap-1.5">
                      <div className="flex h-14 w-full items-center justify-center overflow-hidden rounded-lg bg-gray-50 ring-1 ring-gray-100">
                        {it.image_url ? (
                          // 가족 전용으로 올린 사진도 블록 안에 들어오도록 contain + 축소 표시
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={it.image_url}
                            alt=""
                            className="max-h-[42px] max-w-[42px] object-contain object-center"
                            draggable={false}
                          />
                        ) : (
                          // 기본 이미지도 기존보다 살짝 줄여 블록 안쪽 여백을 확보
                          <MarketItemImage frame={spriteFrame} height={42} />
                        )}
                      </div>
                      <p
                        className="w-full truncate text-center text-[9px] font-bold leading-tight text-gray-700"
                        title={it.name}
                      >
                        {it.name}
                      </p>
                      <VisibilityToggle
                        on={visible}
                        ariaLabel={visible ? `${it.name} 마켓에서 숨기기` : `${it.name} 마켓에 표시하기`}
                        onToggle={() => toggleHidden(it.id, visible)}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
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
              크레딧
              <input
                type="number"
                min={1}
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
                disabled={addLoading || !addName.trim() || !addPrice}
                onClick={submitAdd}
                className="flex-1 rounded-2xl bg-brand-blue py-3 text-sm font-bold text-white shadow-md disabled:opacity-50"
              >
                {addLoading ? '저장 중...' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
