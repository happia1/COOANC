'use client'

/**
 * 미션 완료 시각이 너무 이를 때 뜨는 안내(소리 없음).
 * - 오전에 오후 미션을 누른 경우: illust `dont.png`로 「아직 하면 안 된다」를 보여 줍니다.
 * - 잠 준비 시간 이전에 취침 미션을 누른 경우: 수달 프로필 + X 오버레이로 같은 안내를 합니다.
 * - 연속 탭 팝업(RapidTapConfirmModal)과 달리 음원을 재생하지 않습니다.
 */

import Image from 'next/image'
import { createPortal } from 'react-dom'

export type MissionHonestyBlockReason = 'afternoon_before_noon' | 'bedtime_before_sleep_ready'

type Props = {
  open: boolean
  reason: MissionHonestyBlockReason | null
  onClose: () => void
}

/** 잠 준비 시간 관련 차단일 때 쓰는 캐릭터 이미지 */
const OTTER_SRC = '/assets/img/characters/base/otter_profile.png'

/** 정오 전 오후 미션 차단일 때 쓰는 안내 일러스트(저장 위치: public 아래 동일 경로) */
const AFTERNOON_HONESTY_BLOCK_SRC = '/assets/img/missions/routine/dont.png'

const MESSAGES: Record<MissionHonestyBlockReason, string> = {
  afternoon_before_noon: '오후 미션은 정오(12시) 이후에 할 수 있어요.',
  bedtime_before_sleep_ready: '엄마·아빠가 정한 잠 준비 시간 이후에 해 주세요.',
}

export default function MissionHonestyBlockedModal({ open, reason, onClose }: Props) {
  if (!open || !reason || typeof window === 'undefined') return null

  const detail = MESSAGES[reason]

  const modal = (
    <div
      className="fixed inset-0 z-[205] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="지금은 할 수 없어요"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="닫기"
        onClick={onClose}
      />

      <div className="relative z-10 mx-4 flex w-full max-w-xs flex-col items-center rounded-3xl bg-white px-6 pb-6 pt-8 shadow-2xl">
        {/* 사유별 그림 영역 — 배경색 없음(팝업 흰색과 동일하게 두어 일러스트만 보이게 함) */}
        <div className="relative mb-3 h-36 w-36 shrink-0 overflow-hidden rounded-2xl bg-transparent">
          {reason === 'afternoon_before_noon' ? (
            <Image
              src={AFTERNOON_HONESTY_BLOCK_SRC}
              alt=""
              width={144}
              height={144}
              className="h-full w-full object-contain"
              priority
            />
          ) : (
            <>
              <Image
                src={OTTER_SRC}
                alt=""
                width={144}
                height={144}
                className="h-full w-full object-contain"
                priority
              />
              <span
                className="pointer-events-none absolute bottom-1 right-1 flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-3xl shadow-md"
                aria-hidden
              >
                ❌
              </span>
            </>
          )}
        </div>

        <p className="mb-1 text-center text-2xl font-black text-gray-900">거짓말은 안 돼!</p>
        <p className="mb-6 text-center text-sm font-semibold leading-snug text-gray-600">{detail}</p>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-2xl bg-[#7C6CF8] py-4 text-base font-black text-white shadow-md transition-opacity active:opacity-80"
        >
          알겠어요
        </button>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
