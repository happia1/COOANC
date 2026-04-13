'use client'

/**
 * 루트(/) — 로그인 여부와 계정 역할만 보고 이동합니다.
 * - 디바이스 모드(공유/자녀전용/부모전용) 단계는 사용하지 않습니다.
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import BunnyRunLoader from '@/components/ui/BunnyRunLoader'
import { ASSETS } from '@/constants/assets'
import { createClient } from '@/lib/supabase/client'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    async function route() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      const role = user.user_metadata?.role as string | undefined

      if (role === 'child') {
        router.replace('/home')
        return
      }

      const { count } = await supabase
        .from('family_links')
        .select('*', { count: 'exact', head: true })
        .eq('parent_id', user.id)
      router.replace(count && count > 0 ? '/parent' : '/onboarding')
    }

    route()
  }, [router])

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${ASSETS.layouts.sharedAppBackground})` }}
    >
      <BunnyRunLoader />
    </div>
  )
}
