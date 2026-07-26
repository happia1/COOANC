'use client'

/**
 * 부모 앱 — 가입 후 처음 한 번만 뜨는 시작 안내 팝업입니다.
 *
 * 왜 필요한가:
 * - 미션·마켓·화분은 레벨 0부터 열려 있어서, 레벨업 팝업으로는 **영영** 소개되지 않습니다.
 *   (레벨업 팝업은 「이번에 새로 열린 기능」만 보여 줍니다.)
 * - 아이는 아직 글을 읽기 어려우므로, 사용법은 부모가 보고 아이와 함께 해 주는 쪽이 맞습니다.
 *
 * 동작:
 * - 확인을 누르면 DB 에 기록되어 다시 뜨지 않습니다(기기 간 공통).
 * - 닫은 뒤에도 상단 알림창 → 자녀 레벨 안내 → 각 기능의 「사용법」에서 언제든 다시 볼 수 있습니다.
 */

import { useCallback, useEffect, useState } from 'react'
import { PARENT_CHILD_UNLOCK_MILESTONES } from '@/lib/parentChildLevelUnlocks'
import ParentFeatureHowToCard from '@/components/parent/ParentFeatureHowToCard'
import {
  acknowledgeParentOnboarding,
  hasAcknowledgedParentOnboarding,
  PARENT_ONBOARDING_WELCOME_BASICS,
} from '@/lib/parentOnboardingAck'
import { PARENT_POPUP_BTN_SOLO, PARENT_POPUP_OVERLAY } from '@/lib/parentPopupCardStyles'

/** 레벨 0부터 열려 있는 기본 기능 — 레벨업 팝업으로는 안내되지 않는 것들 */
const BASIC_FEATURES = PARENT_CHILD_UNLOCK_MILESTONES.filter((m) => m.minLevel === 0)

export default function ParentWelcomeTutorialModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    void hasAcknowledgedParentOnboarding(PARENT_ONBOARDING_WELCOME_BASICS).then((acked) => {
      if (!cancelled && !acked) setOpen(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    void acknowledgeParentOnboarding(PARENT_ONBOARDING_WELCOME_BASICS)
  }, [])

  if (!open || BASIC_FEATURES.length === 0) return null

  return (
    <div
      className={`${PARENT_POPUP_OVERLAY} z-[200] bg-black/45`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="parent-welcome-tutorial-title"
    >
      <div className="relative z-10 flex max-h-[85dvh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <p className="text-center text-3xl leading-none" aria-hidden>
            👋
          </p>
          <p
            id="parent-welcome-tutorial-title"
            className="mt-2 text-center text-lg font-black text-gray-800"
          >
            함께 시작해 볼까요?
          </p>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-gray-500">
            아이는 아직 글을 읽기 어려워요.
            <br />
            아래 순서를 보면서 아이와 함께 한 번 해 보세요.
          </p>

          <ul className="mt-4 space-y-2.5">
            {BASIC_FEATURES.map((f) => (
              <li key={f.id}>
                <ParentFeatureHowToCard feature={f} highlight />
              </li>
            ))}
          </ul>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-gray-400">
            이 안내는 상단 알림 → 자녀 레벨 안내에서 언제든 다시 볼 수 있어요.
            <br />
            아이가 레벨을 올리면 새로 열린 기능의 사용법을 그때 또 알려 드릴게요.
          </p>
        </div>

        <div className="shrink-0 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={close}
            className={`${PARENT_POPUP_BTN_SOLO} bg-[#4A90E2] text-white`}
          >
            확인했어요
          </button>
        </div>
      </div>
    </div>
  )
}
