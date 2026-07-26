'use client'

/**
 * 승인 탭 — 프로필 블록 바로 아래에 놓이는 안내 블록입니다.
 *
 * 비개발자 설명:
 * - 이 탭에서 무엇을 할 수 있는지 세 가지를 짧게 알려 줍니다.
 * - 루틴 탭 안내 공지·홈의 레벨 안내와 같은 모양(흰 카드 + 💡 + 오른쪽 X)입니다.
 * - X 를 누르면 사라지고, 확인 상태는 DB 에 저장돼 다른 기기에서도 다시 뜨지 않습니다.
 */

import { useCallback, useEffect, useState } from 'react'
import { PARENT_NEUTRAL_CARD_CLASSNAME } from '@/lib/parentNeutralBlockStyle'
import {
  acknowledgeParentOnboarding,
  hasAcknowledgedParentOnboarding,
  PARENT_ONBOARDING_APPROVAL_TAB,
} from '@/lib/parentOnboardingAck'

/** 승인 탭에서 할 수 있는 일 — 화면에 보이는 블록 순서와 같게 둡니다 */
const GUIDE_LINES = [
  '칭찬 스티커를 아이에게 직접 선물할 수 있어요.',
  '오늘 완료 미션에서 아이가 오늘 끝낸 미션을 확인하고, 다시 하기로 되돌릴 수 있어요.',
  '메뉴 제어로 아이에게 보여 줄 상품을 관리할 수 있어요.',
] as const

export default function ParentApprovalGuideCard() {
  /** null = 아직 확인 전(깜빡임 방지로 숨겨 둡니다) */
  const [dismissed, setDismissed] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    void hasAcknowledgedParentOnboarding(PARENT_ONBOARDING_APPROVAL_TAB).then((acked) => {
      if (!cancelled) setDismissed(acked)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const dismiss = useCallback(() => {
    setDismissed(true)
    void acknowledgeParentOnboarding(PARENT_ONBOARDING_APPROVAL_TAB)
  }, [])

  if (dismissed !== false) return null

  return (
    <section className={`w-full ${PARENT_NEUTRAL_CARD_CLASSNAME} px-3 py-3`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-base leading-none" aria-hidden>
          💡
        </span>

        <ul className="min-w-0 flex-1 space-y-1.5">
          {GUIDE_LINES.map((line) => (
            <li key={line} className="flex gap-1.5">
              <span className="mt-[3px] h-1 w-1 shrink-0 rounded-full bg-gray-300" aria-hidden />
              <p className="min-w-0 text-[12px] font-medium leading-relaxed text-gray-600">{line}</p>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={dismiss}
          aria-label="안내 닫기"
          className="shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden
          >
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </section>
  )
}
