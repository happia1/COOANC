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

export default function MarketTab({ childId, items, requests, credits, level }: Props) {
  const [currentCredits, setCurrentCredits] = useState(credits)
  const [myRequests, setMyRequests] = useState<PurchaseRequest[]>(requests)
  const [pendingItems, setPendingItems] = useState<Set<string>>(
    new Set(requests.filter((r) => r.status === 'pending' && r.item_id).map((r) => r.item_id!)),
  )
  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null)
  const [messageInput, setMessageInput] = useState('')

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  function handleItemClick(item: StoreItem) {
    if (pendingItems.has(item.id) || loading) return
    if (currentCredits < item.credit_price || level < item.level_required) return
    setSelectedItem(item)
    setMessageInput('')
  }

  async function submitRequest() {
    if (!selectedItem) return
    const item = selectedItem
    setSelectedItem(null)
    setLoading(item.id)
    try {
      const res = await fetch('/api/market/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, childId, childMessage: messageInput || null }),
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

  // Up to 9 items arranged on 3 shelves
  const shelfItems = items.slice(0, 9)

  // The highest-priced item gets the BEST badge
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
    // -mx-4 -mt-4 cancels the parent layout's px-4 pt-4 so the cream bg fills edge-to-edge
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
        <div className="px-3">
          {/*
            market_shelf.png is used as the shelf background.
            Items sit in 3 rows that align with the 3 shelf boards in the image.
            background-size: 100% 100% stretches the image to fill the container exactly.
          */}
          <div
            className="w-full rounded-2xl overflow-visible"
            style={{
              backgroundImage: 'url(/assets/img/layouts/backgrounds/market_shelf.png)',
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat',
            }}
          >
            {rows.map((row, rowIdx) => (
              <div
                key={rowIdx}
                className="flex justify-around items-end"
                style={{ height: 120, paddingBottom: 14 }}
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
                      onClick={() => handleItemClick(item)}
                      className="relative flex flex-col items-center gap-1 transition-transform active:scale-90"
                      style={{
                        filter: isActive ? 'none' : 'grayscale(100%) brightness(0.65)',
                        opacity: isPending ? 0.6 : 1,
                      }}
                    >
                      {/* BEST badge – top-right corner */}
                      {isBest && isActive && (
                        <span className="absolute -top-3 -right-1 z-10 bg-green-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full leading-none">
                          BEST
                        </span>
                      )}
                      {/* Pending indicator */}
                      {isPending && (
                        <span className="absolute -top-3 -left-2 text-xs z-10">⏳</span>
                      )}

                      {/* 3D clay-style item image from sprite sheet */}
                      <SpriteImage
                        sheet={MARKET_ITEMS}
                        frame={frameKey}
                        height={68}
                        clipRotated={false}
                      />

                      {/* Price badge: white pill with coin icon */}
                      <div className="flex items-center gap-0.5 bg-white rounded-full px-2 py-0.5 shadow-sm border border-gray-100">
                        <SpriteImage sheet={ICONS} frame="credit" width={12} clipRotated={false} />
                        <span className="text-[10px] font-black text-gray-700">
                          {item.credit_price.toLocaleString()}
                        </span>
                      </div>
                    </button>
                  )
                })}

                {/* Empty slot spacers so the layout stays balanced */}
                {Array.from({ length: 3 - row.length }).map((_, i) => (
                  <div key={`empty-${i}`} style={{ width: 64 }} />
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

      {/* ── Purchase popup ── */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-40 flex items-end bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedItem(null)
          }}
        >
          <div
            className="w-full max-w-md mx-auto rounded-t-3xl overflow-hidden shadow-2xl"
            style={{ background: '#FFF8F0' }}
          >
            {/* Animated characters row */}
            <div className="flex items-end justify-between px-5 pt-6 h-48">
              {/* Left: cash register slides in from the left */}
              <div className="market-pop-left self-end">
                <SpriteImage sheet={SHOP_ANIMATIONS} frame="calculating" width={132} />
              </div>

              {/* Right: credit deduction card + paying hand slides in from right */}
              <div className="market-pop-right flex flex-col items-center gap-1 self-end">
                <div className="bg-white rounded-2xl px-4 py-2.5 shadow-md text-center min-w-[112px]">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <SpriteImage sheet={ICONS} frame="credits" width={14} />
                    <span className="text-[11px] text-gray-400">잔액</span>
                  </div>
                  <p className="text-xl font-black text-brand-blue leading-none">
                    {currentCredits.toLocaleString()}
                  </p>
                  <p className="text-xs font-bold text-red-400 mt-1">
                    ― {selectedItem.credit_price.toLocaleString()}
                  </p>
                  <div className="h-px bg-gray-100 my-1.5" />
                  <p className="text-lg font-black text-green-600">
                    {(currentCredits - selectedItem.credit_price).toLocaleString()}
                  </p>
                </div>
                <SpriteImage sheet={SHOP_ANIMATIONS} frame="paying" width={110} />
              </div>
            </div>

            {/* Item name + optional message */}
            <div className="px-6 pt-3 pb-2">
              <p className="text-base font-black text-brand-text text-center">
                {selectedItem.name}
              </p>
              {selectedItem.description && (
                <p className="text-xs text-gray-400 text-center mt-0.5">
                  {selectedItem.description}
                </p>
              )}
              <textarea
                className="w-full mt-3 border border-gray-200 rounded-xl px-4 py-3 text-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 resize-none bg-white"
                rows={2}
                maxLength={100}
                placeholder="부모님께 하고 싶은 말 (선택)"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 px-6 pb-8 pt-2">
              <button
                onClick={() => setSelectedItem(null)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 bg-white text-sm font-bold text-gray-500"
              >
                취소
              </button>
              <button
                onClick={submitRequest}
                className="flex-1 py-3 rounded-2xl bg-brand-blue text-white text-sm font-bold shadow-md active:scale-95"
              >
                구매 요청 ({selectedItem.credit_price} 크레딧)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
