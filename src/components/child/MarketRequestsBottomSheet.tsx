'use client'

/**
 * 마켓 하단에서 올라오는 「내 요청 현황」시트
 * - 요청별 상태를 회색(대기)·파란(진행)·빨강(반려) 뱃지로 구분
 * - 서울 기준 **최근 3일** 안에 접수된 건만 표시 (`requested_at` 달력일)
 * - 목록은 **주문일 오름차순**(먼저 주문한 것이 위)
 * - `delivered`(도착 완료)는 하단 **접기/펼치기** 블록에 모음(기본 접힘)
 */

import { useEffect, useMemo, useState } from 'react'
import type { PurchaseRequest, StoreItem } from '@/types/database'
import SpriteImage from '@/components/common/SpriteImage'
import { MARKET_ITEMS } from '@/constants/sprites'
import { marketFrameKeyForItemId, type MarketItemFrameKey } from '@/lib/marketItemFrame'
import {
  addSeoulCalendarDays,
  getSeoulDateFromIsoTimestamp,
  getSeoulDateString,
} from '@/lib/koreaDate'
import { purchaseRequestStatusPill } from '@/lib/purchaseRequestStatusUi'

type Props = {
  open: boolean
  onClose: () => void
  requests: PurchaseRequest[]
  marketItems: StoreItem[]
}

/** 서울 달력 기준 오늘 포함 이전 3일(오늘·어제·그제) 안에 주문된 건만 남깁니다 */
function filterRequestsWithinLast3SeoulDays(list: PurchaseRequest[]): PurchaseRequest[] {
  const todaySeoul = getSeoulDateString()
  const oldestSeoul = addSeoulCalendarDays(todaySeoul, -2)
  return list.filter((r) => {
    const day = getSeoulDateFromIsoTimestamp(r.requested_at)
    if (!day) return false
    return day >= oldestSeoul && day <= todaySeoul
  })
}

/** 주문 시각 기준 오름차순 — 위에서부터 시간 순서 */
function sortByRequestedAtAsc(list: PurchaseRequest[]): PurchaseRequest[] {
  return [...list].sort((a, b) => a.requested_at.localeCompare(b.requested_at))
}

/** YYYY-MM-DD → MM.DD (예: 2026-04-07 → 04.07) */
function toMonthDayLabel(seoulDate: string): string {
  const [_, month = '', day = ''] = seoulDate.split('-')
  if (!month || !day) return seoulDate
  return `${month}.${day}`
}

function RequestRow({
  r,
  marketItems,
}: {
  r: PurchaseRequest
  marketItems: StoreItem[]
}) {
  const linked = r.item_id ? marketItems.find((i) => i.id === r.item_id) : undefined
  const frame: MarketItemFrameKey = marketFrameKeyForItemId(r.item_id, r.item_name)
  const su = purchaseRequestStatusPill(r.status)
  /** 요청사항: 내 요청 현황 팝업에서는 approved 문구를 더 단순하게 표기 */
  const statusLabel = r.status === 'approved' ? '배송 준비' : su.label
  const daySeoul = getSeoulDateFromIsoTimestamp(r.requested_at) ?? r.requested_at.slice(0, 10)
  /** 요청사항: 연도는 제외하고 월/일만 노출 */
  const dayMonth = toMonthDayLabel(daySeoul)

  return (
    <li className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/[0.05]">
      {/* 요청사항: 썸네일이 과하게 커 보이지 않도록 카드 이미지 영역을 축소 */}
      <div className="flex h-[3.9rem] w-[3.9rem] shrink-0 items-end justify-center overflow-hidden rounded-xl bg-amber-50/80 ring-1 ring-amber-100">
        {linked?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={linked.image_url}
            alt=""
            className="max-h-[3.45rem] max-w-full object-contain object-bottom"
            draggable={false}
          />
        ) : (
          <SpriteImage sheet={MARKET_ITEMS} frame={frame} height={56} clipRotated={false} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {/* 요청사항: 항목 정보를 한 줄에 압축(이름·가격·날짜) */}
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 flex-1 truncate text-[12px] font-black text-brand-text">
            {r.item_name} · {r.item_price.toLocaleString()} 크레딧 · {dayMonth}
          </p>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black sm:text-[11px] ${su.pillClass}`}
          >
            {statusLabel}
          </span>
        </div>
      </div>
    </li>
  )
}

export default function MarketRequestsBottomSheet({ open, onClose, requests, marketItems }: Props) {
  const [deliveredOpen, setDeliveredOpen] = useState(false)

  /** 시트를 다시 열면 배송 완료 구역은 기본(접힘)으로 돌아갑니다 */
  useEffect(() => {
    if (open) setDeliveredOpen(false)
  }, [open])

  const { activeRows, deliveredRows } = useMemo(() => {
    const inRange = filterRequestsWithinLast3SeoulDays(requests)
    const active = inRange.filter((r) => r.status !== 'delivered')
    const delivered = inRange.filter((r) => r.status === 'delivered')
    return {
      activeRows: sortByRequestedAtAsc(active),
      deliveredRows: sortByRequestedAtAsc(delivered),
    }
  }, [requests])

  if (!open) return null

  const hasAny = activeRows.length > 0 || deliveredRows.length > 0

  return (
    <div className="fixed inset-0 z-[90] flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="닫기"
        onClick={onClose}
      />
      <div
        className="relative z-10 max-h-[min(78vh,520px)] w-full overflow-hidden rounded-t-3xl bg-[#FFF8F0] shadow-[0_-8px_32px_rgba(0,0,0,0.18)]"
        style={{ animation: 'mission-sheet-slide-up 0.32s ease-out forwards' }}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-gray-300/90" aria-hidden />
        <div className="flex items-center justify-between border-b border-black/[0.06] px-5 pb-3 pt-2">
          <h2 className="text-base font-black text-brand-text">내 요청 현황</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1.5 text-sm font-bold text-gray-500 active:bg-black/5"
          >
            닫기
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-8 pt-3" style={{ maxHeight: 'min(68vh, 460px)' }}>
          {!hasAny ? (
            <p className="py-10 text-center text-sm font-bold text-gray-400">
              최근 3일 안에 요청 내역이 없어요
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {activeRows.length > 0 && (
                <ul className="flex flex-col gap-3">
                  {activeRows.map((r) => (
                    <RequestRow key={r.id} r={r} marketItems={marketItems} />
                  ))}
                </ul>
              )}

              {deliveredRows.length > 0 && (
                <div className="border-t border-black/[0.06] pt-3">
                  <button
                    type="button"
                    onClick={() => setDeliveredOpen((v) => !v)}
                    aria-expanded={deliveredOpen}
                    className="flex w-full items-center justify-between rounded-xl bg-white/80 px-3 py-2.5 text-left text-sm font-black text-brand-text ring-1 ring-black/[0.06] active:bg-white"
                  >
                    <span>
                      배송 완료 <span className="font-bold text-gray-400">({deliveredRows.length})</span>
                    </span>
                    <span className="text-gray-400" aria-hidden>
                      {deliveredOpen ? '▲' : '▼'}
                    </span>
                  </button>
                  {deliveredOpen && (
                    <ul className="mt-3 flex flex-col gap-3">
                      {deliveredRows.map((r) => (
                        <RequestRow key={r.id} r={r} marketItems={marketItems} />
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
