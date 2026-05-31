'use client'

/**
 * 부모 홈·루틴·승인 탭에서 쓰는 「자녀 앱 화면으로 들어가기」 링크입니다.
 *
 * 비개발자 설명:
 * - 누르면 서버가 미리보기 쿠키를 심고, **페이지 전체 새로고침 없이** 자녀 홈으로 넘깁니다.
 * - 전환 오버레이는 루트 레이아웃에 있어 중간에 깜빡이지 않습니다.
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { flushSync } from 'react-dom'
import { useCallback, useState, type MouseEvent, type ReactNode } from 'react'
import { useChildEnterTransition } from '@/components/child/ChildEnterTransitionProvider'
import { parentEnterChildUiHref, parentEnterChildUiJsonHref } from '@/lib/parentEnterChildUi'
import { parseJsonFromResponse } from '@/lib/parseJsonResponse'

type Props = {
  childId: string | null | undefined
  className?: string
  'aria-label'?: string
  onClick?: () => void
  children: ReactNode
}

export default function ParentEnterChildUiLink({
  childId,
  className,
  'aria-label': ariaLabel,
  onClick,
  children,
}: Props) {
  const router = useRouter()
  const { childEnterActive, beginChildEnter, endChildEnter } = useChildEnterTransition()
  const [entering, setEntering] = useState(false)
  const href = parentEnterChildUiHref(childId)

  const handleClick = useCallback(
    async (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault()
      if (entering || childEnterActive) return

      flushSync(() => {
        setEntering(true)
        beginChildEnter()
      })
      onClick?.()

      try {
        const res = await fetch(parentEnterChildUiJsonHref(childId), { credentials: 'include' })
        const { data, parseError } = await parseJsonFromResponse<{ ok?: boolean; redirectTo?: string }>(res)
        if (!res.ok || parseError || !data?.ok) {
          throw new Error('enter-child-ui failed')
        }
        router.push(data.redirectTo ?? '/home')
      } catch {
        endChildEnter()
        setEntering(false)
        window.location.assign(href)
      }
    },
    [childEnterActive, beginChildEnter, childId, endChildEnter, entering, href, onClick, router],
  )

  return (
    <Link
      href={href}
      prefetch={false}
      className={className}
      aria-label={ariaLabel}
      onClick={handleClick}
      aria-busy={entering || childEnterActive}
    >
      {children}
    </Link>
  )
}
