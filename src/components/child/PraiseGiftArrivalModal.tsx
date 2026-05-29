'use client'

import { useState } from 'react'
import PraiseGiftConfetti from '@/components/child/PraiseGiftConfetti'
import PraiseUiIcon from '@/components/common/PraiseUiIcon'
import { praiseAssetStickerUrl } from '@/lib/praiseAssetStickers'
import { praiseUiKindFromSpriteKey } from '@/lib/praiseStickerUi'

const BANNER_SRC = '/img/layout/banners/message_popup_bell.png'

type Props = {
  open: boolean
  /** 방금 받은(또는 아직 팝업을 안 본) 스티커의 DB 키 — 랜덤 발급 이미지 표시용 */
  spriteKey: string | null
  /** 곰돌이 판으로 이동 + 도착 확인 처리 */
  onGoStickers: () => void
  /** 닫기만 — 팝업 확인 처리(스티커 시트는 열지 않음) */
  onClose: () => void
}

/**
 * 칭찬 스티커가 발급됐을 때 자녀에게 보이는 축하 팝업
 * - 「훌륭해요!」 + 랜덤(또는 지정) 스티커 이미지
 * - 「스티커 붙이러가기」로 곰돌이 판 시트 연결
 * - 「닫기」로 나중에 붙일 수 있게 팝업만 닫음
 */
export default function PraiseGiftArrivalModal({ open, spriteKey, onGoStickers, onClose }: Props) {
  const [bannerOk, setBannerOk] = useState(true)

  if (!open) return null

  const assetSrc = spriteKey ? praiseAssetStickerUrl(spriteKey) : null
  const uiKind = spriteKey ? praiseUiKindFromSpriteKey(spriteKey) : null

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
            <p className="text-xl font-black leading-snug text-brand-text">훌륭해요!</p>
            <p className="mt-1 text-xs text-gray-600">새 칭찬 스티커를 받았어요</p>

            <div className="mt-4 flex h-24 w-24 items-center justify-center rounded-2xl bg-white/80 shadow-inner">
              {assetSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={assetSrc} alt="받은 스티커" className="h-20 w-20 object-contain" />
              ) : uiKind ? (
                <PraiseUiIcon kind={uiKind} size={72} plain />
              ) : (
                <span className="text-4xl" aria-hidden>
                  ⭐
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onGoStickers}
              className="mt-5 w-full rounded-2xl bg-brand-blue py-3.5 text-sm font-bold text-white shadow-lg transition active:scale-[0.99]"
            >
              스티커 붙이러가기
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-700 transition active:scale-[0.99]"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
