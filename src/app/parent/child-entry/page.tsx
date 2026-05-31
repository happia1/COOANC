'use client'

/**
 * 예전 북마크·직접 주소 진입용 — `/parent/child-entry` 는 더 이상 기본 자동 로그인 경로가 아닙니다.
 * 서버 API 한 번으로 목적지를 정한 뒤 바로 이동합니다.
 */

import { useEffect } from 'react'
import { parseJsonFromResponse } from '@/lib/parseJsonResponse'
import { pickPostLoginNavigationTarget } from '@/lib/pickPostLoginNavigationTarget'
import type { PostLoginRedirectPlan } from '@/lib/resolvePostLoginRedirect'

export default function ParentChildEntryPage() {
  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch('/api/auth/post-login-redirect', { credentials: 'same-origin' })
        const { data, parseError } = await parseJsonFromResponse<PostLoginRedirectPlan>(res)
        if (cancelled || parseError || !data) {
          if (!cancelled) window.location.replace('/login')
          return
        }

        const target = pickPostLoginNavigationTarget(data)
        if (!target) {
          if (!cancelled) window.location.replace('/login')
          return
        }

        if (!cancelled) window.location.replace(target)
      } catch {
        if (!cancelled) window.location.replace('/login')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 via-white to-blue-50 px-6">
      <p className="text-center text-sm font-bold text-gray-700">시작 화면으로 이동하는 중이에요…</p>
    </div>
  )
}
