'use client'

/**
 * 마켓 장바구니(위시리스트) 요약을 아래에서 올려 보여주는 슬라이딩 시트입니다.
 * - 본문 하단에 붙어 있던 「장바구니 N개 · 합계」「미션하러 가기」를 여기로 옮겨 독바에 가리지 않게 합니다.
 * - `mission-sheet-slide-up` 애니메이션은 `globals.css` 에 정의된 것을 그대로 씁니다.
 */

import Link from 'next/link'

type Props = {
  /** 시트를 열지 닫지 */
  open: boolean
  onClose: () => void
  /** 장바구니에 담긴 상품 개수 */
  wishlistCount: number
  /** 장바구니 상품 크레딧 합계 */
  wishlistTotalCredits: number
  /** 지갑(마켓) 잔액 — 부족분 안내에 사용 */
  currentWallet: number
  /** 합계 − 지갑 (0 이상) */
  wishlistShortage: number
}

export default function MarketWishlistBottomSheet({
  open,
  onClose,
  wishlistCount,
  wishlistTotalCredits,
  currentWallet,
  wishlistShortage,
}: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex flex-col justify-end">
      {/* 반투명 배경 탭 시 시트를 닫습니다 */}
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="닫기" onClick={onClose} />
      <div
        className="relative z-10 mb-[calc(60px+env(safe-area-inset-bottom,0px))] max-h-[min(78vh,520px)] w-full overflow-hidden rounded-t-3xl bg-[#FFF8F0] shadow-[0_-8px_32px_rgba(0,0,0,0.18)]"
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
        {/* 스크롤 영역 하단 패딩: 독바(60px) + 안전 영역 + 여유 — 내용이 탭바에 가리지 않음 */}
        <div className="max-h-[min(68vh,460px)] overflow-y-auto px-4 pb-6 pt-3">
          <div className="rounded-2xl border border-amber-900/15 bg-amber-50/90 px-3 py-3 sm:px-4">
            <p className="text-center text-[10px] font-bold text-amber-950/90">
              장바구니 {wishlistCount}개 · 합계{' '}
              <span className="tabular-nums">{wishlistTotalCredits.toLocaleString('ko-KR')}</span> 크레딧
            </p>
            <p className="mt-0.5 text-center text-[10px] text-amber-900/75">
              지갑 <span className="font-black tabular-nums">{currentWallet.toLocaleString('ko-KR')}</span>
              {wishlistShortage > 0 ? (
                <>
                  {' '}
                  · 사려면{' '}
                  <span className="font-black text-orange-700 tabular-nums">
                    {wishlistShortage.toLocaleString('ko-KR')}
                  </span>
                  크레딧이 더 필요해요!
                </>
              ) : (
                <> · 지갑으로 살 수 있어요!</>
              )}
            </p>
            <Link
              href="/mission"
              onClick={onClose}
              className="mt-2 flex w-full items-center justify-center rounded-xl bg-brand-blue py-2.5 text-xs font-black text-white shadow-md active:scale-[0.99]"
            >
              미션하러 가기
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
