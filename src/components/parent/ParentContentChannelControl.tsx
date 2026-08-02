'use client'

/**
 * 부모 승인 탭 — 「콘텐츠 관리」
 *
 * 비개발자 설명:
 * - 「메뉴 제어」와 같은 모양으로, 카테고리마다 접었다 펼 수 있습니다(처음엔 모두 접힘).
 * - 카드는 자녀 화면과 똑같이 썸네일 + 제목만 보여 줍니다.
 * - 카드를 길게 누른 뒤(마우스는 살짝 끌어서) 옮기면 순서가 바뀌고 자동 저장됩니다.
 * - 카드를 짧게 누르면 상세 팝업이 열려 소개 문구·링크를 보고, 자녀 노출을 끄고 켤 수 있습니다.
 * - 「채널 추가하기」로 우리 가족 전용 채널을 넣을 수 있고, 직접 넣은 채널만 삭제됩니다.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
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
import ParentChevron from '@/components/parent/ParentChevron'
import ContentChannelThumbnail from '@/components/child/ContentChannelThumbnail'
import type { ContentCategory, ContentChannel } from '@/types/database'

type Props = {
  childId: string | null
  categories: ContentCategory[]
  /** 이 부모가 볼 수 있는 채널(기본 전체 + 우리 가족 전용) */
  channels: ContentChannel[]
  /** 선택 자녀가 숨긴 채널 id */
  hiddenChannelIds: Set<string>
  /** 선택 자녀에 해당하는 family_links.id */
  familyLinkIdForChild: string | null
  onHiddenChange: (next: Set<string>) => void
  onChannelCreated: (channel: ContentChannel) => void
  onChannelDeleted: (channelId: string) => void
  /** 자녀별 채널 순서(channel_id -> order_rank) */
  channelOrders: Record<string, number>
  onChannelOrderSaved: (nextOrderMap: Record<string, number>) => void
}

type TileDragProps = {
  setNodeRef: (element: HTMLElement | null) => void
  style: CSSProperties
  attributes: DraggableAttributes
  listeners: ReturnType<typeof useSortable>['listeners']
  isDragging: boolean
}

/** 한 카테고리 안에서 카드를 정렬 가능하게 감싸는 래퍼 (메뉴 제어와 동일 방식) */
function SortableChannelTile({
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

const EMPTY_ADD_FORM = { title: '', playlistUrl: '', description: '', categoryKey: '' }

export default function ParentContentChannelControl({
  childId,
  categories,
  channels,
  hiddenChannelIds,
  familyLinkIdForChild,
  onHiddenChange,
  onChannelCreated,
  onChannelDeleted,
  channelOrders,
  onChannelOrderSaved,
}: Props) {
  const [detailChannel, setDetailChannel] = useState<ContentChannel | null>(null)
  const [busyChannelId, setBusyChannelId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM)
  const [adding, setAdding] = useState(false)
  /** 카테고리 구역 접기/펼치기 — 기본은 전부 접힘 */
  const [expandedByKey, setExpandedByKey] = useState<Record<string, boolean>>({})
  const [orderMap, setOrderMap] = useState<Record<string, number>>(channelOrders)
  const [orderSaving, setOrderSaving] = useState(false)
  const [orderSaveErr, setOrderSaveErr] = useState<string | null>(null)

  const orderInitialKey = useMemo(() => JSON.stringify(channelOrders), [channelOrders])
  useEffect(() => {
    setOrderMap(channelOrders)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 초기 맵은 JSON 키에 모두 반영됨
  }, [orderInitialKey])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  /** @dnd-kit hydration mismatch 방지 — 마운트 후에만 드래그를 켭니다 */
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  /** 카테고리별 채널 묶음 — 저장된 순서를 먼저, 없으면 기본 order_index 를 따릅니다 */
  const blocks = useMemo(() => {
    const byKey = new Map<string, ContentChannel[]>()
    for (const ch of channels) {
      const list = byKey.get(ch.category_key)
      if (list) list.push(ch)
      else byKey.set(ch.category_key, [ch])
    }
    const rank = (ch: ContentChannel) =>
      orderMap[ch.id] !== undefined ? orderMap[ch.id] : 1_000_000 + (ch.order_index ?? 0)

    const ordered = categories
      .filter((cat) => byKey.has(cat.key))
      .map((cat) => ({
        key: cat.key,
        title: cat.label,
        items: [...(byKey.get(cat.key) ?? [])].sort((a, b) => rank(a) - rank(b)),
      }))
    /** 카테고리 표에 없는 key 도 빠지지 않게 뒤에 붙입니다 */
    for (const [key, list] of byKey) {
      if (ordered.some((b) => b.key === key)) continue
      ordered.push({ key, title: key, items: [...list].sort((a, b) => rank(a) - rank(b)) })
    }
    return ordered
  }, [channels, categories, orderMap])

  const categoryLabelOf = (key: string) => categories.find((c) => c.key === key)?.label ?? key

  const saveChannelOrder = useCallback(
    async (orderedChannelIds: string[], nextOrderMap: Record<string, number>) => {
      if (!childId) return
      setOrderSaveErr(null)
      setOrderSaving(true)
      try {
        const res = await fetch('/api/content/child-channel-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ childId, orderedChannelIds }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          setOrderSaveErr(typeof json.error === 'string' ? json.error : '순서를 저장하지 못했어요')
          return
        }
        onChannelOrderSaved(nextOrderMap)
      } catch {
        setOrderSaveErr('네트워크 오류로 순서를 저장하지 못했어요')
      } finally {
        setOrderSaving(false)
      }
    },
    [childId, onChannelOrderSaved],
  )

  /** 드래그 종료 → 그 카테고리 안에서만 순서 재계산 후 자동 저장 */
  function handleBlockDragEnd(blockKey: string, ev: DragEndEvent) {
    const { active, over } = ev
    if (!over || active.id === over.id) return

    const idsByKey: Record<string, string[]> = {}
    for (const b of blocks) idsByKey[b.key] = b.items.map((x) => x.id)

    const ids = idsByKey[blockKey] ?? []
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return

    const nextIds = [...ids]
    const [moved] = nextIds.splice(from, 1)
    nextIds.splice(to, 0, moved)
    idsByKey[blockKey] = nextIds

    const orderedAll = blocks.flatMap((b) => idsByKey[b.key] ?? [])
    const nextOrderMap = Object.fromEntries(orderedAll.map((id, idx) => [id, idx]))
    setOrderMap((prev) => ({ ...prev, ...nextOrderMap }))
    void saveChannelOrder(orderedAll, nextOrderMap)
  }

  async function toggleHidden(channelId: string, hide: boolean) {
    if (!childId) return
    setBusyChannelId(channelId)
    setError(null)
    try {
      const res = await fetch('/api/content/child-hidden-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId, channelId, hidden: hide }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? '저장하지 못했어요')
        return
      }
      const next = new Set(hiddenChannelIds)
      if (hide) next.add(channelId)
      else next.delete(channelId)
      onHiddenChange(next)
    } catch {
      setError('네트워크 오류가 발생했어요')
    } finally {
      setBusyChannelId(null)
    }
  }

  async function deleteChannel(channelId: string) {
    if (!childId) return
    if (!window.confirm('이 채널을 삭제할까요?')) return
    setBusyChannelId(channelId)
    setError(null)
    try {
      const res = await fetch('/api/content/parent-channel', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId, channelId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? '삭제하지 못했어요')
        return
      }
      onChannelDeleted(channelId)
      setDetailChannel(null)
    } catch {
      setError('네트워크 오류가 발생했어요')
    } finally {
      setBusyChannelId(null)
    }
  }

  async function addChannel() {
    if (!childId) return
    setAdding(true)
    setError(null)
    try {
      const res = await fetch('/api/content/parent-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId,
          title: addForm.title,
          playlistUrl: addForm.playlistUrl,
          description: addForm.description || undefined,
          categoryKey: addForm.categoryKey,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? '채널을 추가하지 못했어요')
        return
      }
      onChannelCreated(json.channel)
      setAddForm(EMPTY_ADD_FORM)
      setAddOpen(false)
    } catch {
      setError('네트워크 오류가 발생했어요')
    } finally {
      setAdding(false)
    }
  }

  /** 카드 한 칸 — 자녀 화면과 같은 모양(썸네일 + 제목) */
  function renderChannelTile(ch: ContentChannel, drag: TileDragProps | null) {
    const hidden = hiddenChannelIds.has(ch.id)
    const isOwnFamily = ch.family_link_id !== null && ch.family_link_id === familyLinkIdForChild
    return (
      <button
        key={ch.id}
        type="button"
        ref={drag?.setNodeRef}
        style={drag?.style}
        {...(drag?.attributes ?? {})}
        {...(drag?.listeners ?? {})}
        onClick={() => {
          if (drag?.isDragging) return
          setDetailChannel(ch)
        }}
        className={`relative snap-start overflow-hidden rounded-xl border border-gray-100 bg-white text-left shadow-sm transition touch-none active:scale-[0.98] ${
          hidden ? 'opacity-45' : ''
        } ${drag?.isDragging ? 'ring-2 ring-brand-blue/40' : ''}`}
      >
        <ContentChannelThumbnail playlistUrl={ch.playlist_url} storedThumbnailUrl={ch.thumbnail_url} />
        {hidden ? (
          <span className="absolute left-1 top-1 rounded bg-gray-900/75 px-1 py-px text-[8px] font-bold text-white">
            숨김
          </span>
        ) : null}
        {isOwnFamily ? (
          <span className="absolute right-1 top-1 rounded bg-amber-500 px-1 py-px text-[8px] font-bold text-white">
            우리 가족
          </span>
        ) : null}
        <div className="px-1 py-1">
          <p className="line-clamp-2 text-[9px] font-black leading-snug text-gray-900">{ch.title}</p>
        </div>
      </button>
    )
  }

  const detailHidden = detailChannel ? hiddenChannelIds.has(detailChannel.id) : false
  const detailIsOwnFamily =
    detailChannel != null &&
    detailChannel.family_link_id !== null &&
    detailChannel.family_link_id === familyLinkIdForChild

  return (
    <section className="mt-1">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h2 className="text-sm font-bold text-brand-text">콘텐츠 관리</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!childId}
            onClick={() => {
              setError(null)
              setAddOpen(true)
            }}
            className="shrink-0 rounded-lg border border-[#4A90E2]/40 bg-[#4A90E2]/10 px-3 py-1.5 text-[11px] font-bold text-[#2563EB] shadow-sm transition active:scale-95 hover:bg-[#4A90E2]/15 disabled:opacity-30"
          >
            ＋ 채널 추가하기
          </button>
        </div>
      </div>
      <p className="mb-3 text-[11px] leading-snug text-gray-400">
        자녀가 보물 상자 이용권을 구매하면 콘텐츠를 이용할 수 있어요. 영상을 직접 추가/삭제하거나 길게 눌러
        옮기면 순서를 변경할 수 있어요
      </p>

      {error && (
        <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-[11px] font-bold text-red-600 ring-1 ring-red-100" role="alert">
          {error}
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
      ) : blocks.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center text-sm text-gray-400 shadow-sm">
          채널을 추가해주세요.
        </div>
      ) : (
        <div className="space-y-6 rounded-2xl bg-white p-3 shadow-sm">
          {blocks.map((block) => {
            const expanded = expandedByKey[block.key] === true
            const canSort = block.items.length > 1 && mounted
            const tiles = block.items.map((ch) =>
              canSort ? (
                <SortableChannelTile key={ch.id} id={ch.id}>
                  {(drag) => renderChannelTile(ch, drag)}
                </SortableChannelTile>
              ) : (
                renderChannelTile(ch, null)
              ),
            )
            const grid = (
              <div className="grid w-max grid-flow-col grid-rows-1 gap-x-1.5 gap-y-2.5 px-1 auto-cols-[minmax(4.5rem,5rem)] sm:auto-cols-[minmax(5rem,5.5rem)]">
                {tiles}
              </div>
            )

            return (
              <div key={block.key}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-label={expanded ? `${block.title} 구역 접기` : `${block.title} 구역 펼치기`}
                  onClick={() => setExpandedByKey((prev) => ({ ...prev, [block.key]: !expanded }))}
                  className="mb-2 flex w-full items-center gap-2 border-b border-gray-100 pb-2 text-left text-xs font-black text-gray-800 transition-colors active:bg-gray-50/80"
                >
                  <div className="flex min-w-0 flex-1 items-baseline gap-x-2">
                    <span className="min-w-0 truncate">{block.title}</span>
                    <span className="shrink-0 text-[9px] font-extralight tabular-nums tracking-tight text-gray-400">
                      {block.items.length}개
                    </span>
                  </div>
                  <span className="flex shrink-0 items-center text-gray-400" aria-hidden>
                    <ParentChevron open={expanded} />
                  </span>
                </button>

                {expanded ? (
                  <div className="-mx-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden pb-1 pt-1 [scrollbar-width:thin] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-1">
                    {canSort ? (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(ev) => handleBlockDragEnd(block.key, ev)}
                      >
                        <SortableContext
                          items={block.items.map((x) => x.id)}
                          strategy={rectSortingStrategy}
                        >
                          {grid}
                        </SortableContext>
                      </DndContext>
                    ) : (
                      grid
                    )}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {/* ── 채널 추가 시트 ── */}
      {addOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center"
              role="dialog"
              aria-modal="true"
              onClick={(e) => {
                if (e.target === e.currentTarget) setAddOpen(false)
              }}
            >
              <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-4 sm:rounded-3xl">
                <h3 className="mb-3 text-sm font-black text-brand-text">채널 추가하기</h3>
                <div className="flex flex-col gap-2">
                  <input
                    value={addForm.title}
                    onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="채널 이름"
                    className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  />
                  <input
                    value={addForm.playlistUrl}
                    onChange={(e) => setAddForm((f) => ({ ...f, playlistUrl: e.target.value }))}
                    placeholder="유튜브 링크(채널·플레이리스트·영상)"
                    className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  />
                  <textarea
                    value={addForm.description}
                    onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="소개 문구(선택) — 부모 화면에서만 보여요"
                    rows={2}
                    className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  />
                  <select
                    value={addForm.categoryKey}
                    onChange={(e) => setAddForm((f) => ({ ...f, categoryKey: e.target.value }))}
                    className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  >
                    <option value="">카테고리 선택</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.key}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
                {error ? <p className="mt-2 text-[11px] font-bold text-red-600">{error}</p> : null}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAddOpen(false)}
                    className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-bold text-gray-500"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    disabled={adding || !addForm.title || !addForm.playlistUrl || !addForm.categoryKey}
                    onClick={() => void addChannel()}
                    className="flex-1 rounded-2xl bg-brand-blue py-3 text-sm font-bold text-white disabled:opacity-40"
                  >
                    {adding ? '추가하는 중…' : '추가하기'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* ── 상세 팝업 — 부모에게만 보이는 소개 문구·링크 + 노출 토글 ── */}
      {detailChannel && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-5"
              role="dialog"
              aria-modal="true"
              onClick={(e) => {
                if (e.target === e.currentTarget) setDetailChannel(null)
              }}
            >
              <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
                <ContentChannelThumbnail
                  playlistUrl={detailChannel.playlist_url}
                  storedThumbnailUrl={detailChannel.thumbnail_url}
                />
                <div className="px-4 py-3">
                  <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                    {categoryLabelOf(detailChannel.category_key)}
                  </span>
                  <h4 className="mt-1.5 text-base font-black leading-snug text-gray-900">
                    {detailChannel.title}
                  </h4>
                  <p className="mt-1.5 whitespace-pre-line text-[13px] font-bold leading-relaxed text-gray-600">
                    {detailChannel.description ?? '등록된 소개 문구가 없어요.'}
                  </p>
                  <a
                    href={detailChannel.playlist_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block truncate text-[11px] font-bold text-brand-blue underline"
                  >
                    {detailChannel.playlist_url}
                  </a>

                  <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
                    <span className="text-[13px] font-bold text-gray-700">
                      {detailHidden ? '자녀 화면에 숨김' : '자녀 화면에 보임'}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!detailHidden}
                      aria-label={detailHidden ? '보이게 하기' : '숨기기'}
                      disabled={busyChannelId === detailChannel.id}
                      onClick={() => void toggleHidden(detailChannel.id, !detailHidden)}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                        detailHidden ? 'bg-gray-300' : 'bg-[#7ED321]'
                      } ${busyChannelId === detailChannel.id ? 'opacity-40' : 'active:scale-95'}`}
                    >
                      <span
                        className={`absolute top-[2px] h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          detailHidden ? 'left-[2px]' : 'right-[2px]'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="mt-3 flex gap-2">
                    {detailIsOwnFamily ? (
                      <button
                        type="button"
                        disabled={busyChannelId === detailChannel.id}
                        onClick={() => void deleteChannel(detailChannel.id)}
                        className="flex-1 rounded-xl bg-red-50 py-2.5 text-sm font-bold text-red-600 disabled:opacity-50"
                      >
                        삭제
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setDetailChannel(null)}
                      className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-bold text-gray-700"
                    >
                      닫기
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  )
}
