'use client'

import { useState } from 'react'
import type { StoreItem, PurchaseRequest } from '@/types/database'
import SpriteImage from '@/components/common/SpriteImage'
import { MARKET_ITEMS, SHOP_ANIMATIONS, ICONS } from '@/constants/sprites'

// Shelf item sprite frames – cycled by shelf position (index)
const ITEM_FRAMES: (keyof typeof MARKET_ITEMS.frames)[] = [
  'chips',           'chew',            'choco_milk',
  'chocolate',       'gummy',           'icecream',
  'drink',           'candy',           'coockie',
  'bluberry_juice',  'strawberry_milk', 'bear',
  'chew2',           'pudding',         'blocks',
  'mango_juice',     'strawberry_juice','luckybox',
  'flower',          '레이어 9',        '레이어 10',
  'chocolate (2)',
]

type Props = {
  childId: string
  items: StoreItem[]
  requests: PurchaseRequest[]
  credits: number
  level: number
}

type SelectedInfo = {
  item: StoreItem
  frame: keyof typeof MARKET_ITEMS.frames
}

export default function MarketTab({ childId, items, requests, credits, level }: Props) {
  const [currentCredits, setCurrentCredits] = useState(credits)
  const [myRequests, setMyRequests] = useState<PurchaseRequest[]>(requests)
  const [pendingItems, setPendingItems] = useState<Set<string>>(
    new Set(requests.filter((r) => r.status === 'pending' && r.item_id).map((r) => r.item_id!)),
  )
  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [selected, setSelected] = useState<SelectedInfo | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  function handleItemClick(item: StoreItem, frame: keyof typeof MARKET_ITEMS.frames) {
    if (pendingItems.has(item.id) || loading) return
    if (currentCredits < item.credit_price || level < item.level_required) return
    setSelected({ item, frame })
  }

  async function submitRequest() {
    if (!selected) return
    const { item } = selected
    setSelected(null)
    setLoading(item.id)
    try {
      const res = await fetch('/api/market/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, childId }),
      })
      const text = await res.text()
      const json = text ? JSON.parse(text) : {}
      if (!res.ok) {
        showToast(json.error ?? '요청에 실패했어요', false)
        return
      }
      setCurrentCredits((c) => c - item.credit_price)
      setPendingItems((prev) => new Set([...prev, item.id]))
      if (json.request) setMyRequests((prev) => [json.request as PurchaseRequest, ...prev])
      showToast('부모님께 요청했어요!')
    } catch {
      showToast('네트워크 오류가 발생했어요', false)
    } finally {
      setLoading(null)
    }
  }

  // Up to 9 items on 3 shelves
  const shelfItems = items.slice(0, 9)

  // Highest-priced item gets the BEST badge
  const bestItemId = shelfItems.reduce<string | null>((best, item) => {
    if (!best) return item.id
    const bestItem = shelfItems.find((i) => i.id === best)!
    return item.credit_price > bestItem.credit_price ? item.id : best
  }, null)

  const rows = [
    shelfItems.slice(0, 3),
    shelfItems.slice(3, 6),
    shelfItems.slice(6, 9),
  ]

  return (
    // -mx-4 -mt-4 cancels parent layout's px-4 pt-4 so the cream bg fills edge-to-edge
    <div className="-mx-4 -mt-4 flex flex-col min-h-full pb-4" style={{ background: '#FFF8F0' }}>

      {/* ── Toast ── */}
      {toast && (
        <div
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 font-bold text-sm px-5 py-2.5 rounded-full shadow-lg ${
            toast.ok ? 'bg-brand-blue text-white' : 'bg-red-500 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* ── Credit bar ── */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <SpriteImage sheet={ICONS} frame="credits" width={28} />
          <span className="text-2xl font-black text-brand-blue tabular-nums">
            {currentCredits.toLocaleString()}
          </span>
          <span className="text-sm font-bold text-gray-400">크레딧</span>
        </div>
        <div className="bg-white/80 rounded-full px-3 py-1 shadow-sm text-sm font-black text-gray-500">
          Lv.{level}
        </div>
      </div>

      {/* ── Shelf ── */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <SpriteImage sheet={ICONS} frame="market" width={64} />
          <p className="font-bold text-brand-text">아직 상품이 없어요</p>
          <p className="text-sm text-gray-400">부모님이 상품을 추가해주실 거예요!</p>
        </div>
      ) : (
        /*
          Shelf background fills edge-to-edge (no horizontal padding).
          overflow:visible on all ancestors lets sprites taller than a row
          poke upward without being clipped.
        */
        <div style={{ overflow: 'visible' }}>
          <div
            style={{
              backgroundImage: 'url(/assets/img/layouts/backgrounds/market_shelf.png)',
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat',
              // 3 rows × 150 px = 450 px — shelf image stretches to fill exactly
              minHeight: 450,
              overflow: 'visible',
            }}
          >
            {rows.map((row, rowIdx) => (
              <div
                key={rowIdx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-around',
                  alignItems: 'flex-end',
                  height: 150,
                  // space for price badge below + shelf board thickness
                  paddingBottom: 22,
                  paddingLeft: 12,
                  paddingRight: 12,
                  overflow: 'visible',
                }}
              >
                {row.map((item, colIdx) => {
                  const frameKey = ITEM_FRAMES[(rowIdx * 3 + colIdx) % ITEM_FRAMES.length]
                  const canAfford = currentCredits >= item.credit_price
                  const meetsLevel = level >= item.level_required
                  const isPending = pendingItems.has(item.id)
                  const isActive = canAfford && meetsLevel
                  const isBest = item.id === bestItemId

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item, frameKey)}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        overflow: 'visible',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        filter: isActive ? 'none' : 'grayscale(100%) brightness(0.65)',
                        opacity: isPending ? 0.6 : 1,
                        transition: 'transform 0.1s',
                      }}
                    >
                      {/* BEST badge – top-right of item */}
                      {isBest && isActive && (
                        <span
                          style={{
                            position: 'absolute',
                            top: -10,
                            right: -4,
                            zIndex: 10,
                            background: '#22c55e',
                            color: '#fff',
                            fontSize: 8,
                            fontWeight: 900,
                            padding: '2px 5px',
                            borderRadius: 99,
                            lineHeight: 1,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          BEST
                        </span>
                      )}
                      {/* Pending indicator */}
                      {isPending && (
                        <span style={{ position: 'absolute', top: -10, left: -6, fontSize: 12, zIndex: 10 }}>
                          ⏳
                        </span>
                      )}

                      {/* Item sprite — no clipping so tall items show fully */}
                      <SpriteImage
                        sheet={MARKET_ITEMS}
                        frame={frameKey}
                        height={80}
                        clipRotated={false}
                      />

                      {/* Price badge: white pill + coin icon */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          background: '#fff',
                          borderRadius: 99,
                          padding: '2px 8px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          border: '1px solid #f0f0f0',
                        }}
                      >
                        <SpriteImage sheet={ICONS} frame="credit" width={13} clipRotated={false} />
                        <span style={{ fontSize: 10, fontWeight: 900, color: '#444' }}>
                          {item.credit_price.toLocaleString()}
                        </span>
                      </div>
                    </button>
                  )
                })}

                {/* Empty slot spacers */}
                {Array.from({ length: 3 - row.length }).map((_, i) => (
                  <div key={`empty-${i}`} style={{ width: 80 }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── My Requests ── */}
      {myRequests.length > 0 && (
        <section className="px-5 mt-5">
          <p className="mb-2 text-sm font-bold text-brand-text">내 요청 현황</p>
          <div className="flex flex-col gap-2">
            {myRequests.slice(0, 5).map((r) => {
              const isApproved = r.status === 'approved'
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm"
                >
                  <div>
                    <p className="text-sm font-bold text-brand-text">{r.item_name}</p>
                    <p className="text-xs text-gray-400">
                      {r.item_price} 크레딧 · {r.requested_at.slice(0, 10)}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      isApproved ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                    }`}
                  >
                    {isApproved ? '승인됨' : '검토 중'}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Purchase popup (center modal, above dock) ── */}
      {selected && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-6"
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null) }}
        >
          <div
            className="w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden"
            style={{ background: '#FFF8F0' }}
          >
            {/* Item image + name */}
            <div className="flex flex-col items-center pt-7 pb-3 px-6">
              {/* Selected item sprite */}
              <div
                className="rounded-2xl bg-white/70 flex items-center justify-center mb-3 shadow-inner"
                style={{ width: 100, height: 100, overflow: 'visible' }}
              >
                <SpriteImage
                  sheet={MARKET_ITEMS}
                  frame={selected.frame}
                  height={82}
                  clipRotated={false}
                />
              </div>
              <p className="text-base font-black text-brand-text text-center">
                {selected.item.name}
              </p>
              {selected.item.description && (
                <p className="text-xs text-gray-400 text-center mt-0.5">
                  {selected.item.description}
                </p>
              )}
            </div>

            {/* Animated row: calculator | credit deduction | paying hand */}
            <div className="flex items-end justify-between px-4 pb-2" style={{ height: 130 }}>
              {/* Cash register */}
              <div className="market-pop-left self-end">
                <SpriteImage sheet={SHOP_ANIMATIONS} frame="calculating" width={108} />
              </div>

              {/* Credit deduction card */}
              <div className="flex flex-col items-center self-center">
                <div className="bg-white rounded-2xl px-4 py-2.5 shadow-md text-center min-w-[100px]">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <SpriteImage sheet={ICONS} frame="credits" width={13} />
                    <span className="text-[10px] text-gray-400">잔액</span>
                  </div>
                  <p className="text-lg font-black text-brand-blue leading-none">
                    {currentCredits.toLocaleString()}
                  </p>
                  <p className="text-xs font-bold text-red-400 mt-1">
                    ― {selected.item.credit_price.toLocaleString()}
                  </p>
                  <div className="h-px bg-gray-100 my-1.5" />
                  <p className="text-base font-black text-green-600">
                    {(currentCredits - selected.item.credit_price).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Paying hand */}
              <div className="market-pop-right self-end">
                <SpriteImage sheet={SHOP_ANIMATIONS} frame="paying" width={96} />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 px-5 pt-2 pb-6">
              <button
                onClick={() => setSelected(null)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 bg-white text-sm font-bold text-gray-500"
              >
                취소
              </button>
              <button
                onClick={submitRequest}
                className="flex-1 py-3 rounded-2xl bg-brand-blue text-white text-sm font-bold shadow-md active:scale-95"
              >
                구매 요청
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
