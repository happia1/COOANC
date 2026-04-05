import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import ChildNavBar from '@/components/child/ChildNavBar'
import ChildTopBar from '@/components/child/ChildTopBar'
import { createClient } from '@/lib/supabase/server'

/**
 * 아이 앱 공통 레이아웃
 * - 모바일 컨테이너 (max-w-md)
 * - 하늘~초원 소프트 그라디언트 배경
 * - 상단바 (로고 + teal 프로필 칩 + 나가기 버튼)
 * - 하단 내비게이션 바 60px
 *
 * 부모 계정으로 /home 등에 직접 들어오면 인사말에 부모 이름이 나가므로,
 * 로그인한 사용자가 부모(role=parent)이면 자녀 앱이 아니라 부모 화면으로 보냅니다.
 */
export default async function ChildLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (me?.role === 'parent') {
      redirect('/parent')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-green-50 flex flex-col">
      {/* 공통 상단바 — 모든 탭에 노출 */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="w-full max-w-md mx-auto px-4 py-3">
          <ChildTopBar />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto w-full max-w-md mx-auto px-4 pt-4 pb-24">
        {children}
      </main>
      <ChildNavBar />
    </div>
  )
}
