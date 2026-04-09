'use client'

/**
 * 마켓 장바구니(위시리스트) 요약을 아래에서 올려 보여주는 슬라이딩 시트입니다.
 * - 본문 하단에 붙어 있던 「장바구니 N개 · 합계」「미션하러 가기」를 여기로 옮겨 독바에 가리지 않게 합니다.
 * - `mission-sheet-slide-up` 애니메이션은 `globals.css` 에 정의된 것을 그대로 씁니다.
 */

import Link from 'next/link'
import Image from 'next/image'
import type { StoreItem } from '@/types/database'
import SpriteImage from '@/components/common/SpriteImage'
import MarketItemImage from '@/components/common/MarketItemImage'
import { ICONS } from '@/constants/sprites'
import { formatMarketCreditLabel } from '@/lib/applyStoreItemCreditOverrides'
import { marketFrameKeyForItemId } from '@/lib/marketItemFrame'
import { walletImageSrcByStage, walletStageIndexByCredits } from '@/lib/walletStages'
/** 요청사항: 물건이 담긴 장바구니 아이콘(공용 정적 이미지) */
const BASKET_FILLED_SRC = '/assets/img/common/ui/basket_filled.png'

/** 지갑 일러스트: `walletStages`(9단계)와 미션·마켓과 동일 규칙 */

type Props = {
  /** 시트를 열지 닫지 */
  open: boolean
  onClose: () => void
  /** 장바구니 행: 상품 + 수량 */
  wishlistEntries: { item: StoreItem; quantity: number }[]
  /** 장바구니에 담긴 상품 개수 */
  wishlistCount: number
  /** 장바구니 상품 크레딧 합계 */
  wishlistTotalCredits: number
  /** 지갑(마켓) 잔액 — 부족분 안내에 사용 */
  currentWallet: number
  /** 합계 − 지갑 (0 이상) */
  wishlistShortage: number
  /** 수량/삭제 처리 중인 상품 id */
  busyItemId: string | null
  /** X 버튼: 해당 상품 장바구니에서 제거 */
  onRemoveItem: (storeItemId: string) => Promise<boolean>
  /** + / - 버튼: 수량 변경 */
  onChangeQty: (storeItemId: string, quantity: number) => Promise<boolean>
}

export default function MarketWishlistBottomSheet({
  open,
  onClose,
  wishlistEntries,
  wishlistCount,
  wishlistTotalCredits,
  currentWallet,
  wishlistShortage,
  busyItemId,
  onRemoveItem,
  onChangeQty,
}: Props) {
  if (!open) return null
  /** 지갑 - 장바구니 합계: +면 충분, -면 부족 */
  const balanceDiff = currentWallet - wishlistTotalCredits
  const canPurchase = balanceDiff >= 0

  return (
    <div className="fixed inset-0 z-[90] flex flex-col justify-end">
      {/* 반투명 배경 탭 시 시트를 닫습니다 */}
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="닫기" onClick={onClose} />
      <div
        className="relative z-10 mb-[calc(60px+env(safe-area-inset-bottom,0px)+10px)] max-h-[min(80vh,560px)] w-full overflow-hidden rounded-t-3xl bg-[#FFF8F0] shadow-[0_-8px_32px_rgba(0,0,0,0.18)]"
        style={{ animation: 'mission-sheet-slide-up 0.32s ease-out forwards' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="market-wishlist-sheet-title"
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-gray-300/90" aria-hidden />
        <div className="flex items-center justify-between border-b border-black/[0.06] px-5 pb-3 pt-2">
          <h2 id="market-wishlist-sheet-title" className="text-base font-black text-brand-text">
            장바구니
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1.5 text-sm font-bold text-gray-500 active:bg-black/5"
          >
            닫기
          </button>
        </div>
        {/* 스크롤 영역 하단 패딩: 독바 + safe-area + 여유를 크게 두어 마지막 버튼이 가려지지 않게 함 */}
        <div className="max-h-[min(70vh,500px)] overflow-y-auto px-4 pb-[calc(60px+env(safe-area-inset-bottom,0px)+22px)] pt-3">
          {/* 영수증 형태: 작은 이미지 + 물건명 + 금액, 마지막 합계(크레딧 텍스트 제거) */}
          <section className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/85 p-3">
            <p className="text-center text-[11px] font-black text-amber-950">영수증</p>
            <div className="mt-2 space-y-1">
              {wishlistEntries.map(({ item, quantity }) => (
                <div
                  key={`receipt-${item.id}`}
                  className="flex items-center justify-between gap-2 rounded-lg bg-white/70 px-2 py-1.5 text-[10px]"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-amber-100/80">
                      {item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- 외부/스토리지 이미지 URL
                        <img
                          src={item.image_url}
                          alt=""
                          className="max-h-full max-w-full object-contain"
                          draggable={false}
                        />
                      ) : (
                        <MarketItemImage frame={marketFrameKeyForItemId(item.id, item.name)} width={20} />
                      )}
                    </div>
                    <span className="truncate text-gray-700">{item.name}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {/* - 버튼: 최소 1개까지 허용, 1에서 누르면 X로 삭제와 동일 동작 */}
                    <button
                      type="button"
                      onClick={() => void onChangeQty(item.id, quantity - 1)}
                      disabled={busyItemId === item.id}
                      className="h-5 w-5 rounded-full border border-gray-300 text-[11px] font-black text-gray-700 disabled:opacity-50"
                      aria-label={`${item.name} 수량 줄이기`}
                    >
                      -
                    </button>
                    <span className="min-w-[1.2rem] text-center text-[10px] font-black tabular-nums text-gray-700">
                      {quantity}
                    </span>
                    {/* + 버튼: 수량 1개 증가 */}
                    <button
                      type="button"
                      onClick={() => void onChangeQty(item.id, quantity + 1)}
                      disabled={busyItemId === item.id}
                      className="h-5 w-5 rounded-full border border-gray-300 text-[11px] font-black text-gray-700 disabled:opacity-50"
                      aria-label={`${item.name} 수량 늘리기`}
                    >
                      +
                    </button>
                    <span className="ml-1 font-black tabular-nums text-gray-800">
                      {formatMarketCreditLabel(item.credit_price * quantity)}
                    </span>
                    {/* X 버튼: 상품 행 자체 삭제 */}
                    <button
                      type="button"
                      onClick={() => void onRemoveItem(item.id)}
                      disabled={busyItemId === item.id}
                      className="ml-1 h-5 w-5 rounded-full border border-red-200 text-[10px] font-black text-red-500 disabled:opacity-50"
                      aria-label={`${item.name} 장바구니에서 삭제`}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="my-2 border-t border-dashed border-amber-300" />
            <div className="flex items-center justify-between text-[11px] font-black text-amber-950">
              <span>합계 ({wishlistCount}개)</span>
              <span className="tabular-nums">{formatMarketCreditLabel(wishlistTotalCredits)}</span>
            </div>
          </section>

          {/* 하단 요약 블록: 장바구니 / 지갑 / 차액을 크게 보여줌 */}
          <section className="mt-3 grid grid-cols-2 gap-2">
            {/* 요청사항: 순서 변경(내 지갑 먼저, 장바구니 다음) */}
            <div className="rounded-2xl bg-white p-3 text-center shadow-sm ring-1 ring-black/[0.06]">
              {/* 요청사항: 마켓 탭과 동일한 지갑 스프라이트 사용 */}
              <div className="flex justify-center" aria-hidden>
                <Image
                  src={walletImageSrcByStage(walletStageIndexByCredits(currentWallet))}
                  alt=""
                  width={40}
                  height={40}
                  className="h-auto w-9 select-none object-contain"
                  draggable={false}
                />
              </div>
              <p className="mt-1 text-[11px] font-black text-brand-blue">내 지갑</p>
              <p className="mt-0.5 text-base font-black tabular-nums text-brand-blue">
                {currentWallet.toLocaleString('ko-KR')}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-3 text-center shadow-sm ring-1 ring-black/[0.06]">
              {/* 요청사항: 장바구니 블록 아이콘도 basket_filled.png 로 통일 */}
              <div className="flex justify-center" aria-hidden>
                {/* eslint-disable-next-line @next/next/no-img-element -- public 정적 자산 경로 */}
                <img src={BASKET_FILLED_SRC} alt="" className="h-8 w-8 object-contain" draggable={false} />
              </div>
              <p className="mt-1 text-[11px] font-black text-red-500">장바구니</p>
              <p className="mt-0.5 text-base font-black tabular-nums text-red-500">
                {wishlistTotalCredits.toLocaleString('ko-KR')}
              </p>
            </div>
          </section>

          {/* 요청사항: 하단은 '차액' 대신 필요한 크레딧으로 표기 */}
          <section className="mt-2 rounded-2xl border border-black/[0.06] bg-white px-3 py-2.5 text-center">
            <p className="text-[11px] font-black text-gray-700">필요한 크레딧</p>
            <p className={`mt-0.5 text-lg font-black tabular-nums ${canPurchase ? 'text-green-600' : 'text-red-500'}`}>
              {wishlistShortage.toLocaleString('ko-KR')}
            </p>
            <p className="mt-0.5 text-[10px] font-bold text-gray-500">
              {canPurchase ? '지갑 크레딧이 충분해요' : '이만큼 더 모으면 구매할 수 있어요'}
            </p>
          </section>

          {/* 상태별 CTA: +면 구매하기(파랑), -면 미션하러가기(노랑) */}
          <div className="mt-3">
            {canPurchase ? (
              <button
                type="button"
                onClick={onClose}
                className="flex w-full items-center justify-center rounded-xl bg-brand-blue py-3 text-sm font-black text-white shadow-md active:scale-[0.99]"
              >
                구매하기
              </button>
            ) : (
              <Link
                href="/mission"
                onClick={onClose}
                className="flex w-full items-center justify-center rounded-xl bg-yellow-400 py-3 text-sm font-black text-amber-950 shadow-md active:scale-[0.99]"
              >
                미션하러가기
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
