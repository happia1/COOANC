import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import ChildNavBar from '@/components/child/ChildNavBar'
import ChildTopBar from '@/components/child/ChildTopBar'
import { createClient } from '@/lib/supabase/server'

/**
 * 아이 앱 공통 레이아웃
 * - 모바일 컨테이너 (max-w-md)
 * - 하늘~초원 소프트 그라디언트 배경
 * - 상단 내비게이션 바 (자녀 이름 teal 칩 + 나가기)
 * - 하단 내비게이션 바 60px
 *
 * 부모 계정으로 /home 등에 직접 들어오면 부모 화면으로 보냅니다.
 */
export default async function ChildLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let childName = '쿠앵이'

  if (user) {
    const { data: me } = await supabase
      .from('profiles')
      .select('role, name')
      .eq('id', user.id)
      .maybeSingle()

    if (me?.role === 'parent') {
      redirect('/parent')
    }

    if (me?.name?.trim()) {
      childName = me.name.trim()
    } else {
      const meta = user.user_metadata as { name?: string } | undefined
      if (typeof meta?.name === 'string' && meta.name.trim()) {
        childName = meta.name.trim()
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-green-50 flex flex-col">
      <ChildTopBar childName={childName} />
      <main className="flex-1 overflow-y-auto w-full max-w-md mx-auto px-4 pt-4 pb-24">
        {children}
      </main>
      <ChildNavBar />
    </div>
  )
}
