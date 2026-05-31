'use client'

import PraiseGiftConfetti from '@/components/child/PraiseGiftConfetti'
import PraiseUiIcon from '@/components/common/PraiseUiIcon'
import { praiseAssetStickerUrl } from '@/lib/praiseAssetStickers'
import { praiseUiKindFromSpriteKey } from '@/lib/praiseStickerUi'

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
  if (!open) return null

  const assetSrc = spriteKey ? praiseAssetStickerUrl(spriteKey) : null
  const uiKind = spriteKey ? praiseUiKindFromSpriteKey(spriteKey) : null

  return (
    <>
      <PraiseGiftConfetti active={open} />
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4" role="alertdialog">
        {/* 바깥 배너/그라데이션 배경 없이, 흰 카드만 내용 높이에 맞춰 보여 줍니다 */}
        <div className="relative flex w-full max-w-sm flex-col items-center rounded-3xl bg-white px-5 py-6 text-center shadow-2xl">
          <p className="text-xl font-black leading-snug text-brand-text">훌륭해요!</p>
          <p className="mt-1 text-xs text-gray-600">새 칭찬 스티커를 받았어요</p>

          {/* 네모 박스 없이 스티커 아이콘만 표시 */}
          <div className="mt-4 flex items-center justify-center">
            {assetSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assetSrc} alt="받은 스티커" className="h-24 w-24 object-contain" />
            ) : uiKind ? (
              <PraiseUiIcon kind={uiKind} size={88} plain />
            ) : (
              <span className="text-5xl" aria-hidden>
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
    </>
  )
}
