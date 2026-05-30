'use client'

/**
 * 부모 홈·루틴·승인 탭에서 쓰는 「자녀 앱 화면으로 들어가기」 링크입니다.
 *
 * 비개발자 설명:
 * - 누르면 서버가 「지금은 이 자녀 화면을 부모가 본다」는 쿠키를 심고 자녀 홈으로 보냅니다.
 * - 클릭 직후 배경과 「불러오는 중」 안내를 바로 보여 준 뒤 이동합니다(나가기 문과 같은 방식).
 */

import Link from 'next/link'
import { createPortal } from 'react-dom'
import { flushSync } from 'react-dom'
import { useCallback, useState, type MouseEvent, type ReactNode } from 'react'
import ChildAppTransitionOverlay from '@/components/child/ChildAppTransitionOverlay'
import { parentEnterChildUiHref } from '@/lib/parentEnterChildUi'

type Props = {
  /** 자녀 profiles.id — 없으면 서버가 첫 연결 자녀로 맞춤 */
  childId: string | null | undefined
  className?: string
  'aria-label'?: string
  onClick?: () => void
  children: ReactNode
}

const ENTER_STATUS_MESSAGE = '자녀 화면을 불러오는 중…'

export default function ParentEnterChildUiLink({
  childId,
  className,
  'aria-label': ariaLabel,
  onClick,
  children,
}: Props) {
  const [entering, setEntering] = useState(false)
  const href = parentEnterChildUiHref(childId)

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (entering) {
        event.preventDefault()
        return
      }
      event.preventDefault()
      // #region agent log
      fetch('http://127.0.0.1:7447/ingest/9dd0682d-d3af-41fb-8d82-be18fff89b7a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '65823a' },
        body: JSON.stringify({
          sessionId: '65823a',
          location: 'ParentEnterChildUiLink.tsx:handleClick',
          message: 'parent enter child ui click',
          data: { hasChildId: Boolean(childId?.trim()) },
          hypothesisId: 'enter-overlay',
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion
      flushSync(() => setEntering(true))
      onClick?.()
      window.location.assign(href)
    },
    [childId, entering, href, onClick],
  )

  return (
    <>
      <Link
        href={href}
        prefetch={false}
        className={className}
        aria-label={ariaLabel}
        onClick={handleClick}
        aria-busy={entering}
      >
        {children}
      </Link>
      {entering && typeof document !== 'undefined'
        ? createPortal(
            <ChildAppTransitionOverlay statusMessage={ENTER_STATUS_MESSAGE} background="child" />,
            document.body,
          )
        : null}
    </>
  )
}
