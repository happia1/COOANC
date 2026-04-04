'use client'

/**
 * 루트(/) — 디바이스 모드 라우터
 * localStorage의 cooanc_device_mode 값에 따라 적절한 화면으로 분기
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    async function route() {
      const raw = localStorage.getItem('cooanc_device_mode')
      const deviceMode = raw === 'shared' || raw === 'child' || raw === 'parent' ? raw : null

      // 처음 실행 → 모드 설정 화면
      if (!deviceMode) {
        router.replace('/setup')
        return
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      // 로그인 안 된 경우 → 로그인 화면
      if (!user) {
        router.replace('/login')
        return
      }

      const role = user.user_metadata?.role as string | undefined

      if (deviceMode === 'child') {
        // 자녀 전용 디바이스 → 항상 자녀 앱
        router.replace('/home')
        return
      }

      if (deviceMode === 'parent') {
        // 부모 전용 디바이스 → 항상 부모 앱
        const { count } = await supabase
          .from('family_links')
          .select('*', { count: 'exact', head: true })
          .eq('parent_id', user.id)
        router.replace(count && count > 0 ? '/parent' : '/onboarding')
        return
      }

      // shared 모드 → 역할에 따라 분기
      if (role === 'child') {
        router.replace('/home')
      } else {
        const { count } = await supabase
          .from('family_links')
          .select('*', { count: 'exact', head: true })
          .eq('parent_id', user.id)
        router.replace(count && count > 0 ? '/parent' : '/onboarding')
      }
    }

    route()
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-green-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="text-5xl animate-bounce">🌱</div>
        <p className="text-sm text-gray-400 font-bold">COOANC 불러오는 중...</p>
      </div>
    </div>
  )
}
