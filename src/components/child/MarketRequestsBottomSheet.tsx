'use client'

/**
 * 마켓 하단에서 올라오는 「내 요청 현황」시트
 * - 요청별 상태를 회색(대기)·파란(진행)·빨강(반려) 뱃지로 구분
 * - 서울 기준 **최근 3일** 안에 접수된 건만 표시 (`requested_at` 달력일)
 * - 목록은 **주문일 내림차순**(가장 최근 주문이 위)
 * - `delivered`(도착 완료)는 하단 **접기/펼치기** 블록에 모음(기본 접힘)
 */

import { useEffect, useMemo, useState } from 'react'
import type { PurchaseRequest, StoreItem } from '@/types/database'
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss'
import StoreItemThumbnail from '@/components/common/StoreItemThumbnail'
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

/** 내 요청(진행/대기/반려) 기본 노출 개수 — 초과분은 「더보기」 */
const ACTIVE_PREVIEW_COUNT = 3

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

/** 주문 시각 기준 내림차순 — 최신 요청이 위 */
function sortByRequestedAtDesc(list: PurchaseRequest[]): PurchaseRequest[] {
  return [...list].sort((a, b) => b.requested_at.localeCompare(a.requested_at))
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
      {/* 요청사항: 썸네일을 기존 대비 절반 수준으로 추가 축소 */}
      <div className="flex h-[2rem] w-[2rem] shrink-0 items-end justify-center overflow-hidden rounded-lg bg-amber-50/80 ring-1 ring-amber-100">
        <StoreItemThumbnail
          imageUrl={linked?.image_url}
          itemName={r.item_name}
          frame={frame}
          height={28}
          className="max-h-[1.75rem] max-w-full object-contain object-bottom"
          loading="lazy"
          sizes="32px"
        />
      </div>
      <div className="min-w-0 flex-1">
        {/* 요청사항: 블록 높이 축소를 위해 상품명 옆에 날짜를 같은 줄로 배치 */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1">
              <p className="min-w-0 flex-1 truncate text-[12px] font-black text-brand-text">{r.item_name}</p>
              <p className="shrink-0 text-[10px] text-gray-400">{dayMonth}</p>
            </div>
            <p className="mt-0.5 text-[11px] font-black tabular-nums text-red-500">
              - {r.item_price.toLocaleString()} 크레딧
            </p>
          </div>
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
  const [activeShowAll, setActiveShowAll] = useState(false)
  const swipe = useSwipeToDismiss(onClose)

  /** 시트를 다시 열면 배송 완료 구역은 기본(접힘)으로 돌아갑니다 */
  useEffect(() => {
    if (open) {
      setDeliveredOpen(false)
      setActiveShowAll(false)
    }
  }, [open])

  const { activeRows, deliveredRows } = useMemo(() => {
    const inRange = filterRequestsWithinLast3SeoulDays(requests)
    const active = inRange.filter((r) => r.status !== 'delivered')
    const delivered = inRange.filter((r) => r.status === 'delivered')
    return {
      activeRows: sortByRequestedAtDesc(active),
      deliveredRows: sortByRequestedAtDesc(delivered),
    }
  }, [requests])

  if (!open) return null

  const hasAny = activeRows.length > 0 || deliveredRows.length > 0
  const visibleActiveRows = activeShowAll ? activeRows : activeRows.slice(0, ACTIVE_PREVIEW_COUNT)
  const activeHasMore = activeRows.length > ACTIVE_PREVIEW_COUNT

  return (
    <div className="fixed inset-0 z-[90] flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="닫기"
        onClick={onClose}
      />
      <div
        className="relative z-10 max-h-[min(78vh,520px)] w-full overflow-hidden rounded-t-3xl bg-[#FFF8F0] shadow-[0_-8px_32px_rgba(0,0,0,0.18)] transition-transform duration-300 ease-out"
        style={{ animation: 'mission-sheet-slide-up 0.32s ease-out', ...swipe.dragStyle }}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-gray-300/90" aria-hidden />
        <div className="flex touch-none items-center justify-between border-b border-black/[0.06] px-5 pb-3 pt-2" {...swipe.handleProps}>
          <h2 className="text-base font-black text-brand-text">내 요청 현황</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1.5 text-sm font-bold text-gray-500 active:bg-black/5"
          >
            닫기
          </button>
        </div>
        {/* 요청사항: 독바(하단 고정 영역)에 마지막 카드가 가리지 않도록 하단 패딩 확대 */}
        <div
          className="overflow-y-auto px-4 pt-3 pb-[max(6rem,env(safe-area-inset-bottom))]"
          style={{ maxHeight: 'min(68vh, 460px)' }}
        >
          {!hasAny ? (
            <p className="py-10 text-center text-sm font-bold text-gray-400">
              최근 3일 안에 요청 내역이 없어요
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {activeRows.length > 0 && (
                <div>
                  <ul className="flex flex-col gap-3">
                    {visibleActiveRows.map((r) => (
                      <RequestRow key={r.id} r={r} marketItems={marketItems} />
                    ))}
                  </ul>
                  {activeHasMore && (
                    <button
                      type="button"
                      onClick={() => setActiveShowAll((v) => !v)}
                      className="mt-2 w-full rounded-xl border border-gray-200 bg-white/80 py-2 text-xs font-bold text-brand-text"
                    >
                      {activeShowAll
                        ? `간단히 보기 (${ACTIVE_PREVIEW_COUNT}개)`
                        : `더보기 (${activeRows.length - ACTIVE_PREVIEW_COUNT}개 더)`}
                    </button>
                  )}
                </div>
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
