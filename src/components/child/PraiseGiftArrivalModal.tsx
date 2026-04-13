'use client'

import { useState } from 'react'
import PraiseGiftConfetti from '@/components/child/PraiseGiftConfetti'

const BANNER_SRC = '/img/layout/banners/message_popup_bell.png'

type Props = {
  open: boolean
  /** 곰돌이 판으로 이동 + 도착 확인 처리 */
  onGoStickers: () => void
}

/**
 * 부모가 칭찬 스티커를 보낸 뒤 자녀에게 보이는 축하 팝업
 * - 배경: 종 모양 메시지 팝업 이미지(없으면 부드러운 대체 카드)
 * - 컨페티 + 「스티커 붙이러가기」로 곰돌이 판 시트 연결
 */
export default function PraiseGiftArrivalModal({ open, onGoStickers }: Props) {
  const [bannerOk, setBannerOk] = useState(true)

  if (!open) return null

  return (
    <>
      <PraiseGiftConfetti active={open} />
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4" role="alertdialog">
        <div className="relative w-full max-w-sm overflow-hidden rounded-3xl shadow-2xl">
          {bannerOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={BANNER_SRC}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              onError={() => setBannerOk(false)}
            />
          ) : (
            <div
              className="absolute inset-0 bg-gradient-to-br from-sky-200 via-white to-amber-100"
              aria-hidden
            />
          )}

          <div className="relative z-[1] mx-3 mb-4 mt-12 flex flex-col items-center rounded-2xl bg-white/90 px-5 py-6 text-center shadow-md backdrop-blur-[2px]">
            {!bannerOk && <span className="mb-2 text-4xl" aria-hidden>🔔</span>}
            <p className="text-lg font-black leading-snug text-brand-text">
              칭찬스티커를
              <br />
              선물 받았어요!
            </p>
            <p className="mt-2 text-xs text-gray-600">지금 곰돌이 판에 붙여 볼까요?</p>

            <button
              type="button"
              onClick={onGoStickers}
              className="mt-5 w-full rounded-2xl bg-brand-blue py-3.5 text-sm font-bold text-white shadow-lg transition active:scale-[0.99]"
            >
              스티커 붙이러가기
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
