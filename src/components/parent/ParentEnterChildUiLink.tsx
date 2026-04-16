'use client'

/**
 * 부모 홈·루틴·승인 탭에서 쓰는 「자녀 앱 화면으로 들어가기」 링크입니다.
 *
 * 비개발자 설명:
 * - 누르면 서버가 「지금은 이 자녀 화면을 부모가 본다」는 쿠키를 심고 자녀 홈으로 보냅니다.
 * - Next.js 기본 동작은 보이는 링크를 미리 불러오는데(prefetch), 이 API 는 불필요한 호출이 많아져 끕니다.
 */

import Link from 'next/link'
import type { ReactNode } from 'react'
import { parentEnterChildUiHref } from '@/lib/parentEnterChildUi'

type Props = {
  /** 자녀 profiles.id — 없으면 서버가 첫 연결 자녀로 맞춤 */
  childId: string | null | undefined
  className?: string
  'aria-label'?: string
  onClick?: () => void
  children: ReactNode
}

export default function ParentEnterChildUiLink({ childId, className, 'aria-label': ariaLabel, onClick, children }: Props) {
  return (
    <Link href={parentEnterChildUiHref(childId)} prefetch={false} className={className} aria-label={ariaLabel} onClick={onClick}>
      {children}
    </Link>
  )
}
