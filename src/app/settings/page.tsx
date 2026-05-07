'use client'

/**
 * `/settings` 직접 주소 처리입니다.
 * - 부모 계정: 부모 앱 탭 안으로 들여 `/parent/home?settings=open` 으로 보내 설정 시트가 열리게 합니다.
 * - 그 외(자녀 등): 예전처럼 스크롤 가능한 전체 페이지로 설정 본문만 보여 줍니다(상단에 홈 링크).
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ParentSettingsPanelContent from '@/components/parent/ParentSettingsPanelContent'

export default function SettingsPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'checking' | 'redirect-parent' | 'standalone'>('checking')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) router.replace('/login')
        return
      }
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      const role = data?.role
      if (cancelled) return
      if (role === 'parent') {
        setMode('redirect-parent')
        router.replace('/parent/home?settings=open')
        return
      }
      setMode('standalone')
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  if (mode === 'checking' || mode === 'redirect-parent') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-gradient-to-b from-sky-50 via-white to-blue-50 px-6">
        <p className="text-sm font-bold text-gray-600">설정으로 이동 중…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-green-50 px-4 pb-10 pt-6">
      <div className="mx-auto mb-4 flex max-w-md items-center justify-between">
        <Link href="/home" className="text-[11px] font-bold text-[#4A90E2] underline-offset-2 hover:underline">
          홈으로
        </Link>
      </div>
      <div className="mx-auto max-w-md">
        <p className="mb-4 text-center text-sm font-black text-gray-900">설정</p>
        <ParentSettingsPanelContent />
      </div>
    </div>
  )
}
