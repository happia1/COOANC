'use client'

import Image from 'next/image'

type Props = {
  /** 팝업을 열지 닫지 */
  open: boolean
  /** 닫기(「나중에」 등) */
  onDismiss: () => void
  /**
   * 「엄마에게 알려주기」를 눌렀을 때 호출됩니다.
   * 같은 가족의 부모 앱이 구독 중인 Supabase 브로드캐스트 채널로 알림을 보냅니다.
   */
  onNotifyParent?: () => void
}

/**
 * 곰돌이 판 20칸을 모두 채웠을 때 뜨는 축하 팝업입니다.
 * - 예전에는 마켓으로 가서 선물을 고르도록 했지만, 이제는 엄마가 골라 주는 선물(랜덤 박스) 흐름으로 바뀌었습니다.
 * - 아이에게는 랜덤 박스 이미지를 보여 주고, 엄마에게 알림을 보낼 수 있게 합니다.
 */
export default function BearBoardCompleteModal({ open, onDismiss, onNotifyParent }: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bear-board-complete-title"
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        {/* 제목: 한 줄 띄우고 두 번째 문장을 넣어 읽기 쉽게 했습니다 */}
        <h2
          id="bear-board-complete-title"
          className="text-center text-lg font-black leading-snug text-brand-text whitespace-pre-line"
        >
          {`축하해요!\n스티커를 다 붙였어요.`}
        </h2>

        {/* 미션 홈과 같은 크레딧 보상 시트의 금색 상자 — 「랜덤 선물 박스」로 보여 줍니다 */}
        <div className="mt-5 flex flex-col items-center gap-2">
          {/** 예전 `credits.png` 아틀라스의 `gold_box` 프레임 대신 개별 PNG 사용 */}
          <div className="relative flex h-[120px] w-full items-end justify-center">
            <Image
              src="/assets/img/items/rewards/gold_box.png"
              alt=""
              width={205}
              height={190}
              className="h-auto w-[96px] max-w-full select-none object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.2)]"
            />
          </div>
          <p className="text-center text-sm font-bold text-brand-blue">랜덤박스</p>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              onNotifyParent?.()
              onDismiss()
            }}
            className="w-full rounded-2xl bg-brand-blue py-3.5 text-center text-sm font-bold text-white shadow-md transition active:scale-[0.99]"
          >
            엄마에게 알려주기
          </button>
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
