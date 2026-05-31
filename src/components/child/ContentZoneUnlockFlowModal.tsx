'use client'

import { useFeatureUnlockCelebrationSound } from '@/hooks/useFeatureUnlockCelebrationSound'
import { CHILD_CONTENT_TREASURE_ICON_URL } from '@/constants/childContentMenu'

type Props = {
  open: boolean
  onClose: () => void
  /** 하단 버튼 — 마켓 콘텐츠 이용권 구역으로 이동 */
  onGoToMarketContent: () => void
}

/**
 * 보물상자(레벨 8) 해금 축하 팝업
 * - 보물상자 아이콘 등장 안내
 * - 상점에서 콘텐츠 이용권 구매 가능 안내
 */
export default function ContentZoneUnlockFlowModal({ open, onClose, onGoToMarketContent }: Props) {
  useFeatureUnlockCelebrationSound(open)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="보물상자 해금 안내"
    >
      <style>{`
        @keyframes treasurePop {
          0% { transform: scale(0.75) rotate(-8deg); opacity: 0; }
          60% { transform: scale(1.08) rotate(4deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
      `}</style>

      <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl ring-2 ring-amber-100">
        <div className="flex flex-col items-center text-center">
          <div
            className="relative h-20 w-20"
            style={{ animation: 'treasurePop 540ms ease-out forwards' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={CHILD_CONTENT_TREASURE_ICON_URL}
              alt=""
              className="h-full w-full object-contain drop-shadow-md"
              draggable={false}
            />
          </div>
          <p className="mt-3 text-lg font-black text-amber-700">축하해! 보물상자가 열렸어요!</p>
          <p className="mt-2 text-sm font-semibold leading-snug text-gray-600">
            이제 상점에서 콘텐츠 이용권을
            <br />
            구매할 수 있어요!
          </p>
          <button
            type="button"
            onClick={() => {
              onGoToMarketContent()
              onClose()
            }}
            className="mt-5 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 py-2.5 text-sm font-black text-white shadow-md"
          >
            콘텐츠 이용권 보러가기
          </button>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 text-xs font-bold text-gray-400 underline underline-offset-2"
          >
            나중에 볼게요
          </button>
        </div>
      </div>
    </div>
  )
}
