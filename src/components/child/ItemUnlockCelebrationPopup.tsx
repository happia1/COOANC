'use client'

import { createPortal } from 'react-dom'
import Image from 'next/image'
import { ASSETS } from '@/constants/assets'
import type { TriggerKey } from '@/lib/gameLayer/triggerItemMap'

const TRIGGER_LABELS: Record<TriggerKey, string> = {
  FIRST_MISSION:    '첫 미션 완료',
  FIRST_SAVE:       '첫 저금통 저축',
  FIRST_WALLET_USE: '첫 지갑 사용',
  ADD_TO_CART:      '첫 장바구니 담기',
  FIRST_PURCHASE:   '첫 구매 요청',
}

interface ItemUnlockCelebrationPopupProps {
  itemIndex: number
  triggerKey: TriggerKey
  onClose: () => void
}

export default function ItemUnlockCelebrationPopup({
  itemIndex,
  triggerKey,
  onClose,
}: ItemUnlockCelebrationPopupProps) {
  const imgSrc = ASSETS.characters.decorItemImages[itemIndex] ?? ASSETS.characters.decorItemImages[0]

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[350] flex items-center justify-center bg-black/50 px-5"
      role="dialog"
      aria-modal="true"
      aria-label="새 아이템 잠금 해제"
    >
      <div className="flex max-w-[min(20rem,calc(100vw-2.5rem))] flex-col items-center gap-4 rounded-3xl bg-white px-6 py-7 shadow-2xl ring-2 ring-yellow-200">
        <div className="text-3xl">🎁</div>
        <p className="text-center text-sm font-black text-gray-500">
          {TRIGGER_LABELS[triggerKey]}
        </p>
        <div className="item-unlock-pop relative h-28 w-28">
          <Image
            src={imgSrc}
            alt="새 아이템"
            fill
            className="object-contain"
          />
        </div>
        <p className="text-center text-base font-black leading-snug text-brand-text">
          새 아이템이 열렸어요!
        </p>
        <p className="text-center text-xs text-gray-400">
          홈에서 캐릭터를 꾸며보세요 ✨
        </p>
        <button
          onClick={onClose}
          className="w-full rounded-xl bg-gradient-to-r from-yellow-400 to-orange-400 py-2.5 text-sm font-black text-white shadow active:scale-95"
        >
          확인
        </button>
      </div>
    </div>,
    document.body,
  )
}
