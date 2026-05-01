'use client'

/**
 * 미션 카드 연속 탭 감지 확인 팝업
 *
 * 비개발자: 아이가 미션 카드를 아주 빠르게 여러 장 탭하면 이 창이 떠요. 정말 끝냈는지 다시 확인합니다.
 *
 * 3초 이내에 5개 이상의 미션 카드를 연속으로 탭했을 때 노출됩니다.
 * - 이미지: `/assets/img/missions/routine/dont_lie.png`
 * - 음성: `거짓말은 나 속상해.wav` 재생 후 약 0.3초 뒤 `no.wav` 추가 재생(1회)
 * - 버튼: 「미안.. 다시 할게」「정말 다 했어!」— 둘 다 누르면 재생 중인 소리를 먼저 멈춥니다.
 */

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { createPortal } from 'react-dom'
import { CHILD_AUDIO } from '@/lib/childAudio'

type Props = {
  /** 팝업 표시 여부 */
  open: boolean
  /** 「정말 다 했어!」— 5번째 미션을 완료로 처리 */
  onConfirm: () => void
  /** 「미안.. 다시 할게」— 5번째 미션 완료 취소 */
  onDeny: () => void
}

const DONT_LIE_IMG_SRC = '/assets/img/missions/routine/dont_lie.png'

export default function RapidTapConfirmModal({ open, onConfirm, onDeny }: Props) {
  const dontLieAudioRef = useRef<HTMLAudioElement | null>(null)
  const noAudioRef = useRef<HTMLAudioElement | null>(null)

  /** 연속 재생 중인 두 트랙을 모두 끕니다 */
  function stopAll() {
    const refs = [dontLieAudioRef, noAudioRef]
    for (const r of refs) {
      const el = r.current
      if (el) {
        el.pause()
        el.currentTime = 0
        r.current = null
      }
    }
  }

  useEffect(() => {
    if (!open) return

    const dontLie = new Audio(CHILD_AUDIO.dontLie)
    dontLie.volume = 0.85
    dontLieAudioRef.current = dontLie
    void dontLie.play().catch(() => {
      /* 자동재생 정책으로 차단될 수 있음 — UI는 그대로 유지 */
    })

    /** 첫 멘트 후 짧은 보조음 */
    const noTimer = window.setTimeout(() => {
      const no = new Audio(CHILD_AUDIO.popupAlert)
      no.volume = 0.9
      noAudioRef.current = no
      void no.play().catch(() => {})
    }, 300)

    return () => {
      window.clearTimeout(noTimer)
      stopAll()
    }
  }, [open])

  function handleConfirm() {
    stopAll()
    onConfirm()
  }

  function handleDeny() {
    stopAll()
    onDeny()
  }

  if (!open || typeof window === 'undefined') return null

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="정말 다 했어?"
    >
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 mx-4 flex w-full max-w-xs flex-col items-center rounded-3xl bg-white px-6 pb-6 pt-8 shadow-2xl">
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

        <p className="mb-6 text-center text-2xl font-black text-gray-900">정말 한 거 맞아?</p>

        <div className="flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full rounded-2xl bg-[#4A90E2] py-4 text-base font-black text-white shadow-md transition-opacity active:opacity-80"
          >
            정말 다 했어! 🙌
          </button>
          <button
            type="button"
            onClick={handleDeny}
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
