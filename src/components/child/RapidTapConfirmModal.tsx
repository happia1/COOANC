'use client'

/**
 * 미션 카드 연속 탭 감지 확인 팝업
 *
 * 3초 이내에 5개 이상의 미션 카드를 연속으로 탭했을 때 노출됩니다.
 * - 이미지: /assets/img/missions/routine/dont_lie.png
 * - 음성: /assets/audio/alerts/거짓말은 나 속상해.wav (마운트 시 자동 재생, 1회만)
 * - 버튼: "미안.. 다시할게" (취소) / "정말 다 했어!" (확인)
 *
 * 비개발자 설명:
 * 아이가 미션 카드를 너무 빠르게 여러 번 탭하면 이 팝업이 나타납니다.
 * 캐릭터 이미지와 함께 "정말 다 했어?" 라고 물어보며, 아이가 직접 확인 또는 취소를 누릅니다.
 */

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { createPortal } from 'react-dom'

type Props = {
  /** 팝업 표시 여부 */
  open: boolean
  /** "정말 다 했어!" 버튼 — 5번째 미션을 완료로 처리합니다 */
  onConfirm: () => void
  /** "미안.. 다시할게" 버튼 — 5번째 미션 완료를 취소합니다 */
  onDeny: () => void
}

/** 확인 팝업에 쓸 이미지/음성 경로 */
const DONT_LIE_IMG_SRC = '/assets/img/missions/routine/dont_lie.png'
const DONT_LIE_AUDIO_SRC = '/assets/audio/alerts/거짓말은 나 속상해.wav'

export default function RapidTapConfirmModal({ open, onConfirm, onDeny }: Props) {
  /** 음성을 한 번만 재생하기 위한 Audio 인스턴스 */
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!open) return

    /** 팝업이 열릴 때마다 새 Audio 객체를 만들어 처음부터 재생합니다 */
    const audio = new Audio(DONT_LIE_AUDIO_SRC)
    audio.volume = 0.85
    audioRef.current = audio

    void audio.play().catch(() => {
      // 브라우저 자동재생 정책으로 인해 소리가 나지 않을 수 있습니다 — 조용히 무시합니다
    })

    return () => {
      audio.pause()
      audio.currentTime = 0
      audioRef.current = null
    }
  }, [open])

  if (!open) return null
  if (typeof window === 'undefined') return null

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="정말 다 했어?"
    >
      {/* 반투명 배경 — 탭해도 닫히지 않습니다(의도적 확인 필요) */}
      <div className="absolute inset-0 bg-black/60" />

      {/* 팝업 카드 */}
      <div className="relative z-10 mx-4 flex w-full max-w-xs flex-col items-center rounded-3xl bg-white px-6 pb-6 pt-8 shadow-2xl">

        {/* 캐릭터 이미지 */}
        <div className="mb-4 h-36 w-36 overflow-hidden rounded-2xl">
          <Image
            src={DONT_LIE_IMG_SRC}
            alt="거짓말은 나 속상해"
            width={144}
            height={144}
            className="h-full w-full object-contain"
            priority
          />
        </div>

        {/* 메인 메시지 */}
        <p className="mb-1 text-center text-2xl font-black text-gray-900">
          정말 한 거 맞아?
        </p>

        {/* 서브 메시지 */}
        <p className="mb-6 text-center text-sm font-medium leading-relaxed text-gray-500">
          미션을 아주 빠르게 많이 눌렀어요.
          <br />
          정말 다 완료했는지 확인해 줘요!
        </p>

        {/* 버튼 2개 */}
        <div className="flex w-full flex-col gap-3">
          {/* 확인 버튼 */}
          <button
            type="button"
            onClick={onConfirm}
            className="w-full rounded-2xl bg-[#4A90E2] py-4 text-base font-black text-white shadow-md transition-opacity active:opacity-80"
          >
            정말 다 했어! 🙌
          </button>

          {/* 취소 버튼 */}
          <button
            type="button"
            onClick={onDeny}
            className="w-full rounded-2xl bg-gray-100 py-4 text-base font-bold text-gray-600 transition-opacity active:opacity-80"
          >
            미안.. 다시 할게 😅
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
