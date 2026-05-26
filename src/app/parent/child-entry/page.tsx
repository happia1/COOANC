'use client'

/**
 * 자녀가 **둘 이상**일 때 루트(/)에서만 들어오는 짧은 중간 화면입니다.
 *
 * 비개발자 설명:
 * - 로그인 직후 어디로 갈지는 일부가 **폰/브라우저 안의 localStorage** 에만 있어서,
 *   서버만으로는 읽을 수 없습니다.
 * - 그래서 서버는 먼저 이 주소로 보내고, 여기서 저장된 `defaultChildId` 가 있으면
 *   그 아이의 「자녀 앱 미리보기」로 넘기고, 없으면 부모 홈으로 보냅니다.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { parentEnterChildUiHref } from '@/lib/parentEnterChildUi'
import { getStoredDefaultChildId, setStoredDefaultChildId } from '@/lib/defaultChildIdPreference'

export default function ParentChildEntryPage() {
  const router = useRouter()
  const [hint, setHint] = useState('시작 화면으로 이동하는 중이에요…')

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

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (profile?.role !== 'parent') {
        if (!cancelled) router.replace('/home')
        return
      }

      const { data: links, error: linkErr } = await supabase
        .from('family_links')
        .select('child_id')
        .eq('parent_id', user.id)

      if (linkErr || cancelled) {
        if (!cancelled) {
          setHint('연결 정보를 불러오지 못했어요. 부모 홈으로 이동합니다.')
          router.replace('/parent/home')
        }
        return
      }

      const childIds = (links ?? []).map((l) => l.child_id).filter(Boolean) as string[]

      /** 자녀가 없으면 온보딩(기존 루트와 동일한 기대 동작) */
      if (childIds.length === 0) {
        if (!cancelled) router.replace('/onboarding')
        return
      }

      /** 한 명뿐이면 저장값과 관계없이 그 아이로 (직접 주소로 들어온 경우 대비) */
      if (childIds.length === 1) {
        if (!cancelled) {
          window.location.replace(parentEnterChildUiHref(childIds[0]))
        }
        return
      }

      const preferred = getStoredDefaultChildId()
      if (preferred && childIds.includes(preferred)) {
        if (!cancelled) {
          window.location.replace(parentEnterChildUiHref(preferred))
        }
        return
      }
      if (preferred) {
        /** 예전 기기·다른 계정에서 남은 UUID 면 그대로 두면 매번 여기서 막히므로 지웁니다 */
        setStoredDefaultChildId(null)
      }
      if (!cancelled) {
        setHint('부모 홈으로 이동합니다.')
        router.replace('/parent/home')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 via-white to-blue-50 px-6">
      <p className="text-center text-sm font-bold text-gray-700">{hint}</p>
    </div>
  )
}
