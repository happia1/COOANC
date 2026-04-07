'use client'

import Link from 'next/link'

type Props = {
  open: boolean
  onDismiss: () => void
  /** 상점 링크를 눌렀을 때 바텀시트 등을 닫을 때 사용 */
  onGoMarket?: () => void
}

/**
 * 곰돌이 판 20칸을 모두 채웠을 때 — 선물 안내 + 마켓 이동
 */
export default function BearBoardCompleteModal({ open, onDismiss, onGoMarket }: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bear-board-complete-title"
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <h2 id="bear-board-complete-title" className="text-center text-lg font-black text-brand-text">
          축하해요! 스티커판을 다 채웠어요!
        </h2>
        <p className="mt-2 text-center text-sm leading-relaxed text-gray-600">
          원하는 선물을 <span className="font-bold text-brand-blue">1개</span> 고를 수 있어요!
        </p>
        <div className="mt-4 flex justify-center">
          {/* 요청 이미지 경로: public/assets/img/common/ui/icons.png */}
          {/* eslint-disable-next-line @next/next/no-img-element -- 완료 팝업 고정 아이콘 */}
          <img
            src="/assets/img/common/ui/icons.png"
            alt="상점 아이콘"
            width={64}
            height={64}
            className="h-16 w-16 object-contain"
          />
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <Link
            href="/market"
            onClick={() => {
              onDismiss()
              onGoMarket?.()
            }}
            className="block w-full rounded-2xl bg-brand-blue py-3.5 text-center text-sm font-bold text-white shadow-md transition active:scale-[0.99]"
          >
            선물 고르러가기
          </Link>
          <button
            type="button"
            onClick={onDismiss}
            className="w-full rounded-2xl border border-gray-200 py-3 text-sm font-bold text-gray-500"
          >
            나중에
          </button>
        </div>
      </div>
    </div>
  )
}
