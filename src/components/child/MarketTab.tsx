'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { StoreItem, PurchaseRequest } from '@/types/database'
import SpriteImage from '@/components/common/SpriteImage'
import { MARKET_ITEMS, SHOP_ANIMATIONS, ICONS } from '@/constants/sprites'
import { createClient } from '@/lib/supabase/client'
import { marketFrameKeyForItemId, type MarketItemFrameKey } from '@/lib/marketItemFrame'

type Props = {
  childId: string
  items: StoreItem[]
  requests: PurchaseRequest[]
  credits: number
  level: number
}

type SelectedInfo = {
  item: StoreItem
  frame: MarketItemFrameKey
}

/** 배달 연출 단계: 배송 출발 안내 → 낙하산 도착 연출 */
type DeliveryPhase = 'shipping' | 'parachute'

type DeliveryOverlay = {
  request: PurchaseRequest
  frame: MarketItemFrameKey
  phase: DeliveryPhase
}

const ROOF_SRC = '/assets/img/layouts/backgrounds/market_roof.png'

export default function MarketTab({ childId, items, requests, credits, level }: Props) {
  const [currentCredits, setCurrentCredits] = useState(credits)
  const [myRequests, setMyRequests] = useState<PurchaseRequest[]>(requests)
  const [pendingItems, setPendingItems] = useState<Set<string>>(
    new Set(requests.filter((r) => r.status === 'pending' && r.item_id).map((r) => r.item_id!)),
  )
  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [selected, setSelected] = useState<SelectedInfo | null>(null)
  const [delivery, setDelivery] = useState<DeliveryOverlay | null>(null)
  /** 배달 연출이 끝난 뒤 「받았어요」 버튼을 잠깐 뒤에 보여 줍니다 */
  const [showReceiveBtn, setShowReceiveBtn] = useState(false)
  /** 승인된 요청이 연속으로 올 때, 한 건씩만 연출하고 나머지는 줄을 섭니다 */
  const deliveryWaitRef = useRef<PurchaseRequest[]>([])

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  /** 다음 배달 연출을 꺼내거나, 대기 줄에 넣습니다 */
  const offerDelivery = useCallback((req: PurchaseRequest) => {
    if (req.status !== 'approved') return
    setDelivery((cur) => {
      if (!cur) {
        return {
          request: req,
          frame: marketFrameKeyForItemId(req.item_id, req.item_name),
          phase: 'shipping',
        }
      }
      deliveryWaitRef.current.push(req)
      return cur
    })
  }, [])

  /** 연출 종료 후 대기 중인 다음 요청이 있으면 이어서 재생합니다 */
  const finishDeliveryAndDequeue = useCallback(() => {
    setDelivery(null)
    setShowReceiveBtn(false)
    const next = deliveryWaitRef.current.shift()
    if (next) {
      window.setTimeout(() => {
        offerDelivery(next)
      }, 80)
    }
  }, [offerDelivery])

  /** 부모가 승인하면 같은 상품은 더 이상 「요청 중」이 아님 */
  const onRequestApproved = useCallback((req: PurchaseRequest) => {
    if (req.item_id) {
      setPendingItems((prev) => {
        const n = new Set(prev)
        n.delete(req.item_id!)
        return n
      })
    }
    offerDelivery(req)
  }, [offerDelivery])

  /**
   * 첫 진입 시 이미 「승인」된 요청이 있으면 순서대로 연출합니다.
   * 동시에 여러 건이 있으면 첫 건만 바로 재생하고 나머지는 대기 줄에 넣습니다(상태 배치 충돌 방지).
   */
  useEffect(() => {
    const approved = requests
      .filter((r) => r.status === 'approved')
      .sort((a, b) => (a.approved_at ?? '').localeCompare(b.approved_at ?? ''))
    if (approved.length === 0) return
    deliveryWaitRef.current.push(...approved.slice(1))
    offerDelivery(approved[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 최초 props 기준 한 번만 자동 재생
  }, [])

  /** Supabase 실시간: 승인·반려를 바로 반영합니다 */
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`market_pr:${childId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'purchase_requests',
          filter: `child_id=eq.${childId}`,
        },
        (payload) => {
          const row = payload.new as PurchaseRequest | null
          const old = payload.old as Partial<PurchaseRequest> | null
          if (!row) return

          setMyRequests((prev) => {
            const i = prev.findIndex((r) => r.id === row.id)
            if (i >= 0) {
              const copy = [...prev]
              copy[i] = row
              return copy
            }
            return [row, ...prev]
          })

          if (row.status === 'approved' && old?.status === 'pending') {
            onRequestApproved(row)
          }
          if (row.status === 'rejected' && old?.status === 'pending') {
            if (row.item_id) {
              setPendingItems((prev) => {
                const n = new Set(prev)
                n.delete(row.item_id!)
                return n
              })
            }
            setCurrentCredits((c) => c + row.item_price)
          }
          if (row.status === 'delivered') {
            setMyRequests((prev) => prev.map((r) => (r.id === row.id ? row : r)))
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [childId, onRequestApproved])

  /** 「배송 중」단계가 잠시 지나면 낙하산 도착 단계로 넘깁니다 */
  useEffect(() => {
    if (!delivery || delivery.phase !== 'shipping') return
    const t = window.setTimeout(() => {
      setDelivery((d) => (d && d.request.id === delivery.request.id ? { ...d, phase: 'parachute' } : d))
    }, 3200)
    return () => window.clearTimeout(t)
  }, [delivery])

  /** 낙하산 단계에서 버튼은 애니메이션이 거의 끝난 뒤에 표시합니다 */
  useEffect(() => {
    if (!delivery || delivery.phase !== 'parachute') {
      setShowReceiveBtn(false)
      return
    }
    const t = window.setTimeout(() => setShowReceiveBtn(true), 2400)
    return () => window.clearTimeout(t)
  }, [delivery])

  function handleItemClick(item: StoreItem, frame: MarketItemFrameKey) {
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

  async function completeDeliveryFlow() {
    if (!delivery) return
    setLoading('delivery')
    try {
      /* 임시: 「받았어요」 버그 원인 파악용 — 로컬 디버그 서버로만 전송, 배포 전 제거 예정 */
      // #region agent log
      fetch('http://127.0.0.1:7447/ingest/9dd0682d-d3af-41fb-8d82-be18fff89b7a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '59d117' },
        body: JSON.stringify({
          sessionId: '59d117',
          location: 'MarketTab.tsx:completeDeliveryFlow:start',
          message: '받았어요 클릭 후 API 호출 직전',
          data: {
            requestIdLen: delivery.request.id?.length ?? 0,
            propsChildIdLen: childId?.length ?? 0,
          },
          timestamp: Date.now(),
          hypothesisId: 'H2',
        }),
      }).catch(() => {})
      // #endregion
      const res = await fetch('/api/market/complete-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: delivery.request.id }),
      })
      const text = await res.text()
      // #region agent log
      fetch('http://127.0.0.1:7447/ingest/9dd0682d-d3af-41fb-8d82-be18fff89b7a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '59d117' },
        body: JSON.stringify({
          sessionId: '59d117',
          location: 'MarketTab.tsx:completeDeliveryFlow:afterFetch',
          message: 'API 응답 수신',
          data: {
            status: res.status,
            ok: res.ok,
            textLen: text.length,
            textLooksJson: text.trim().startsWith('{'),
          },
          timestamp: Date.now(),
          hypothesisId: 'H4',
        }),
      }).catch(() => {})
      // #endregion
      const json = text ? JSON.parse(text) : {}
      if (!res.ok) {
        showToast(json.error ?? '완료 처리에 실패했어요', false)
        return
      }
      const id = delivery.request.id
      setMyRequests((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status: 'delivered' as const, delivered_at: new Date().toISOString() } : r,
        ),
      )
      showToast('상품을 받았어요!')
      finishDeliveryAndDequeue()
    } catch {
      // #region agent log
      fetch('http://127.0.0.1:7447/ingest/9dd0682d-d3af-41fb-8d82-be18fff89b7a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '59d117' },
        body: JSON.stringify({
          sessionId: '59d117',
          location: 'MarketTab.tsx:completeDeliveryFlow:catch',
          message: 'completeDeliveryFlow 예외',
          data: {},
          timestamp: Date.now(),
          hypothesisId: 'H4',
        }),
      }).catch(() => {})
      // #endregion
      showToast('네트워크 오류가 발생했어요', false)
    } finally {
      setLoading(null)
    }
  }

  const shelfItems = items.slice(0, 9)
  const bestItemId = shelfItems.reduce<string | null>((best, item) => {
    if (!best) return item.id
    const bestItem = shelfItems.find((i) => i.id === best)!
    return item.credit_price > bestItem.credit_price ? item.id : best
  }, null)

  const rows = [shelfItems.slice(0, 3), shelfItems.slice(3, 6), shelfItems.slice(6, 9)]

  // 레이아웃이 화면 높이 고정(`h-dvh`)이므로 마켓은 이 안에서만 세로 스크롤 (`min-h-0 flex-1` = 메인에 꽉 참)
  return (
    <div
      className="-mx-4 -mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto pb-4"
      style={{ background: '#FAF5EF' }}
    >

      {toast && (
        <div
          className={`fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-bold shadow-lg ${
            toast.ok ? 'bg-brand-blue text-white' : 'bg-red-500 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* 상단 줄무늬 지붕만 PNG 로 — 아래는 카드 진열 (배경 일러스트 제거) */}
      <div className="w-full overflow-hidden leading-none">
        {/* eslint-disable-next-line @next/next/no-img-element -- 정적 배너, 최적화 없이 경로만 표시 */}
        <img
          src={ROOF_SRC}
          alt=""
          className="block w-full select-none"
          draggable={false}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      </div>

      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <SpriteImage sheet={ICONS} frame="credits" width={28} />
          <span className="text-2xl font-black tabular-nums text-brand-blue">{currentCredits.toLocaleString()}</span>
          <span className="text-sm font-bold text-gray-400">크레딧</span>
        </div>
        <div className="rounded-full bg-white/90 px-3 py-1 text-sm font-black text-gray-500 shadow-sm">Lv.{level}</div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24">
          <SpriteImage sheet={ICONS} frame="market" width={64} />
          <p className="font-bold text-brand-text">아직 상품이 없어요</p>
          <p className="text-sm text-gray-400">부모님이 상품을 추가해주실 거예요!</p>
        </div>
      ) : (
        <div className="px-3 pb-2">
          {rows.map((row, rowIdx) => (
            <div key={rowIdx} className="mb-1">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {row.map((item) => {
                  const frameKey = marketFrameKeyForItemId(item.id, item.name)
                  const canAfford = currentCredits >= item.credit_price
                  const meetsLevel = level >= item.level_required
                  const isPending = pendingItems.has(item.id)
                  const isActive = canAfford && meetsLevel
                  const isBest = item.id === bestItemId

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleItemClick(item, frameKey)}
                      className={`relative flex flex-col rounded-2xl bg-white/95 p-2 pt-3 shadow-md ring-1 ring-black/[0.06] transition-transform active:scale-[0.98] ${
                        isActive ? '' : 'grayscale brightness-[0.72]'
                      } ${isPending ? 'opacity-60' : ''}`}
                    >
                      {isBest && isActive && (
                        <span className="absolute right-1 top-1 z-10 rounded-full bg-green-500 px-1.5 py-0.5 text-[8px] font-black leading-none text-white">
                          BEST
                        </span>
                      )}
                      {isPending && (
                        <span className="absolute left-1 top-1 z-10 text-xs" aria-hidden>
                          ⏳
                        </span>
                      )}

                      {/*
                        고정 높이 안에서 그림을 아래쪽에 맞춤 → 아이스크림처럼 위로 긴 상품도 잘리지 않고 위로만 자랍니다.
                        모든 카드의 이미지 영역 크기를 같게 해서 정렬이 맞습니다.
                      */}
                      <div className="relative flex h-[100px] w-full items-end justify-center overflow-visible">
                        <div className="flex max-h-[96px] max-w-[96px] items-end justify-center">
                          <SpriteImage sheet={MARKET_ITEMS} frame={frameKey} height={88} clipRotated={false} />
                        </div>
                      </div>

                      <div className="mt-1 flex justify-center">
                        <div
                          className="inline-flex items-center gap-1 rounded-full border border-gray-100 bg-white px-2 py-0.5 shadow-sm"
                          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}
                        >
                          <SpriteImage sheet={ICONS} frame="credit" width={13} clipRotated={false} />
                          <span className="text-[11px] font-black text-gray-600 tabular-nums">
                            {item.credit_price.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
                {Array.from({ length: 3 - row.length }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
              </div>

              {/* 선반 느낌: 아래쪽에 그림자·라인으로 층을 구분 */}
              {rowIdx < rows.length - 1 && (
                <div
                  className="mx-1 mt-3 h-2 rounded-full"
                  style={{
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.14), rgba(0,0,0,0))',
                    boxShadow: '0 6px 12px rgba(101, 67, 33, 0.12)',
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {myRequests.length > 0 && (
        <section className="mt-4 px-5">
          <p className="mb-2 text-sm font-bold text-brand-text">내 요청 현황</p>
          <div className="flex flex-col gap-2">
            {myRequests.slice(0, 8).map((r) => {
              const label =
                r.status === 'pending'
                  ? { text: '검토 중', cls: 'bg-amber-50 text-amber-700' }
                  : r.status === 'approved'
                    ? { text: '배송 중', cls: 'bg-sky-50 text-sky-700' }
                    : r.status === 'delivered'
                      ? { text: '도착 완료', cls: 'bg-green-50 text-green-700' }
                      : { text: '반려됨', cls: 'bg-gray-100 text-gray-500' }
              return (
                <div key={r.id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <div>
                    <p className="text-sm font-bold text-brand-text">{r.item_name}</p>
                    <p className="text-xs text-gray-400">
                      {r.item_price.toLocaleString()} 크레딧 · {r.requested_at.slice(0, 10)}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${label.cls}`}>{label.text}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelected(null)
          }}
        >
          <div className="w-full max-w-sm overflow-hidden rounded-3xl shadow-2xl" style={{ background: '#FFF8F0' }}>
            <div className="flex flex-col items-center px-6 pb-3 pt-7">
              <div
                className="mb-3 flex items-end justify-center overflow-visible rounded-2xl bg-white/70 shadow-inner"
                style={{ width: 112, height: 112 }}
              >
                <SpriteImage sheet={MARKET_ITEMS} frame={selected.frame} height={92} clipRotated={false} />
              </div>
              <p className="text-center text-base font-black text-brand-text">{selected.item.name}</p>
              {selected.item.description && (
                <p className="mt-0.5 text-center text-xs text-gray-400">{selected.item.description}</p>
              )}
            </div>

            <div className="flex h-[130px] items-end justify-between px-4 pb-2">
              <div className="market-pop-left self-end">
                <SpriteImage sheet={SHOP_ANIMATIONS} frame="calculating" width={108} />
              </div>
              <div className="flex flex-col items-center self-center">
                <div className="min-w-[100px] rounded-2xl bg-white px-4 py-2.5 text-center shadow-md">
                  <div className="mb-1 flex items-center justify-center gap-1">
                    <SpriteImage sheet={ICONS} frame="credits" width={13} />
                    <span className="text-[10px] text-gray-400">잔액</span>
                  </div>
                  <p className="text-lg font-black leading-none text-brand-blue">{currentCredits.toLocaleString()}</p>
                  <p className="mt-1 text-xs font-bold text-red-400">― {selected.item.credit_price.toLocaleString()}</p>
                  <div className="my-1.5 h-px bg-gray-100" />
                  <p className="text-base font-black text-green-600">
                    {(currentCredits - selected.item.credit_price).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="market-pop-right self-end">
                <SpriteImage sheet={SHOP_ANIMATIONS} frame="paying" width={96} />
              </div>
            </div>

            <div className="flex gap-3 px-5 pb-6 pt-2">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex-1 rounded-2xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-500"
              >
                취소
              </button>
              <button
                type="button"
                onClick={submitRequest}
                className="flex-1 rounded-2xl bg-brand-blue py-3 text-sm font-bold text-white shadow-md active:scale-95"
              >
                구매 요청
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 배달 연출: 승인 직후 — 체크(allow)·선물(reward) + 오토바이(delivery) 플로팅 */}
      {delivery && delivery.phase === 'shipping' && (
        <div className="fixed inset-0 z-[45] flex flex-col items-center justify-center bg-black/45 px-5">
          <p className="mb-4 text-center text-lg font-black leading-snug text-white drop-shadow-md">
            구매가 승인되어
            <br />
            배달이 시작되었어요!
          </p>
          <div className="flex items-end justify-center gap-2">
            <SpriteImage sheet={SHOP_ANIMATIONS} frame="allow" width={100} clipRotated={false} />
            <SpriteImage sheet={SHOP_ANIMATIONS} frame="reward" width={88} clipRotated={false} />
          </div>
          <p className="mt-3 text-center text-sm font-bold text-white/90">곧 도착해요</p>

          <div
            className="pointer-events-none fixed bottom-28 left-5 z-[46] animate-market-moto drop-shadow-xl"
            aria-hidden
          >
            <SpriteImage sheet={SHOP_ANIMATIONS} frame="delivery" width={72} clipRotated={false} />
          </div>
        </div>
      )}

      {delivery && delivery.phase === 'parachute' && (
        <div className="fixed inset-0 z-[45] flex flex-col items-center justify-center bg-gradient-to-b from-sky-300/90 to-amber-50/95 px-5">
          <p className="mb-6 text-center text-lg font-black text-brand-text">상품이 도착했어요!</p>

          <div
            className="pointer-events-none fixed bottom-28 left-5 z-[46] animate-market-moto drop-shadow-xl"
            aria-hidden
          >
            <SpriteImage sheet={SHOP_ANIMATIONS} frame="delivery" width={64} clipRotated={false} />
          </div>

          <div className="animate-market-parachute flex flex-col items-center">
            <span className="text-4xl" aria-hidden>
              🪂
            </span>
            <div className="-mt-1 flex items-end justify-center" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' }}>
              <SpriteImage sheet={MARKET_ITEMS} frame={delivery.frame} height={96} clipRotated={false} />
            </div>
            <p className="mt-2 text-center text-sm font-bold text-gray-600">{delivery.request.item_name}</p>
          </div>

          {showReceiveBtn && (
            <button
              type="button"
              disabled={loading === 'delivery'}
              onClick={() => void completeDeliveryFlow()}
              className="mt-10 rounded-2xl bg-brand-blue px-8 py-3.5 text-sm font-black text-white shadow-lg disabled:opacity-50"
            >
              {loading === 'delivery' ? '처리 중...' : '받았어요!'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
