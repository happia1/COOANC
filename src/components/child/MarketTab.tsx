'use client'

import { useState } from 'react'
import type { StoreItem, PurchaseRequest } from '@/types/database'

const CATEGORY_LABEL: Record<string, string> = {
  food: '음식',
  toy: '장난감',
  activity: '활동',
  digital: '디지털',
  experience: '경험',
}

const STATUS_LABEL: Record<string, { text: string; style: string }> = {
  pending: { text: '검토 중', style: 'bg-amber-50 text-amber-600 border-amber-200' },
  approved: { text: '승인됨', style: 'bg-green-50 text-green-600 border-green-200' },
}

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
  const [messageInput, setMessageInput] = useState<{ itemId: string; text: string } | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  async function handleRequest(item: StoreItem) {
    if (pendingItems.has(item.id) || loading) return
    setMessageInput({ itemId: item.id, text: '' })
  }

  async function submitRequest(item: StoreItem, childMessage: string) {
    setMessageInput(null)
    setLoading(item.id)
    try {
      const res = await fetch('/api/market/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, childId, childMessage: childMessage || null }),
      })
      const text = await res.text()
      const json = text ? JSON.parse(text) : {}
      if (!res.ok) {
        showToast(json.error ?? '요청에 실패했어요', false)
        return
      }
      setCurrentCredits((c) => c - item.credit_price)
      setPendingItems((prev) => new Set([...prev, item.id]))
      if (json.request) {
        setMyRequests((prev) => [json.request as PurchaseRequest, ...prev])
      }
      showToast('부모님께 요청했어요!')
    } catch {
      showToast('네트워크 오류가 발생했어요', false)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">

      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 font-bold text-sm px-5 py-2.5 rounded-full shadow-lg ${toast.ok ? 'bg-brand-blue text-white' : 'bg-red-500 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* 메시지 입력 모달 */}
      {messageInput && (() => {
        const item = items.find((i) => i.id === messageInput.itemId)
        if (!item) return null
        return (
          <div className="fixed inset-0 z-40 bg-black/40 flex items-end justify-center">
            <div className="w-full max-w-md bg-white rounded-t-3xl p-6 shadow-2xl">
              <p className="mb-1 text-base font-black text-brand-text">{item.name}</p>
              <p className="text-xs text-gray-400 mb-4">부모님께 하고 싶은 말을 적어봐요 (선택)</p>
              <textarea
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-brand-text placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 resize-none"
                rows={3}
                maxLength={100}
                placeholder="예: 이거 정말 갖고 싶어요!"
                value={messageInput.text}
                onChange={(e) => setMessageInput({ ...messageInput, text: e.target.value })}
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setMessageInput(null)}
                  className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-500"
                >
                  취소
                </button>
                <button
                  onClick={() => submitRequest(item, messageInput.text)}
                  className="flex-1 py-3 rounded-2xl bg-brand-blue text-white text-sm font-bold shadow-md active:scale-95"
                >
                  요청 보내기 ({item.credit_price} 크레딧)
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 크레딧 잔액 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">내 크레딧</p>
          <p className="text-2xl font-black text-brand-blue tabular-nums">{currentCredits.toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">레벨</p>
          <p className="text-lg font-black text-brand-text">Lv.{level}</p>
        </div>
      </div>

      {/* 내 요청 현황 */}
      {myRequests.length > 0 && (
        <section>
          <p className="mb-2 px-1 text-sm font-bold text-brand-text">내 요청 현황</p>
          <div className="flex flex-col gap-2">
            {myRequests.map((r) => {
              const s = STATUS_LABEL[r.status] ?? STATUS_LABEL.pending
              return (
                <div key={r.id} className={`flex items-center justify-between bg-white rounded-xl px-4 py-3 border ${s.style}`}>
                  <div>
                    <p className="text-sm font-bold text-brand-text">{r.item_name}</p>
                    <p className="text-xs text-gray-400">
                      {r.item_price} 크레딧 · {r.requested_at.slice(0, 10)}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full border ${s.style}`}>
                    {s.text}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 상품 목록 */}
      <section>
        <p className="mb-2 px-1 text-sm font-bold text-brand-text">마켓</p>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <span className="sr-only">상품 없음</span>
            <div className="text-center space-y-1">
              <p className="font-bold text-brand-text">아직 상품이 없어요</p>
              <p className="text-sm text-gray-400">부모님이 상품을 추가해주실 거예요!</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((item) => {
              const isPending = pendingItems.has(item.id)
              const canAfford = currentCredits >= item.credit_price
              const isLoading = loading === item.id
              return (
                <div
                  key={item.id}
                  className={[
                    'bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-2',
                    !canAfford && !isPending ? 'opacity-60' : '',
                  ].join(' ')}
                >
                  {/* 카테고리 */}
                  {item.category && (
                    <span className="text-[10px] text-gray-400 font-bold">
                      {CATEGORY_LABEL[item.category] ?? item.category}
                    </span>
                  )}

                  {/* 아이콘 + 이름 */}
                  <div className="flex flex-col items-center gap-1 py-2">
                    <span className="text-[10px] font-black text-gray-400">
                      {item.item_type === 'digital' ? '디지털' : '실물'}
                    </span>
                    <p className="text-sm font-bold text-brand-text text-center line-clamp-2">
                      {item.name}
                    </p>
                    {item.description && (
                      <p className="text-[10px] text-gray-400 text-center line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* 가격 */}
                  <p className="text-center font-black text-brand-blue text-base">
                    {item.credit_price.toLocaleString()} 크레딧
                  </p>

                  {/* 버튼 */}
                  <button
                    onClick={() => handleRequest(item)}
                    disabled={isPending || isLoading || !canAfford}
                    className={[
                      'w-full py-2 rounded-xl text-xs font-bold transition-all active:scale-95',
                      isPending
                        ? 'bg-amber-50 text-amber-500 border border-amber-200 cursor-default'
                        : !canAfford
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-brand-blue text-white shadow-md hover:bg-blue-600',
                    ].join(' ')}
                  >
                    {isPending ? '요청 중 ⏳' : !canAfford ? '크레딧 부족' : '구매 요청'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
