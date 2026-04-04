import type { ReactNode } from 'react'
import ChildNavBar from '@/components/child/ChildNavBar'

/**
 * 아이 앱 공통 레이아웃
 * - 모바일 컨테이너 (max-w-md)
 * - 하늘~초원 소프트 그라디언트 배경
 * - 하단 내비게이션 바 60px
 */
export default function ChildLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-green-50 flex flex-col">
      <main className="flex-1 overflow-y-auto w-full max-w-md mx-auto px-4 pt-6 pb-24">
        {children}
      </main>
      <ChildNavBar />
    </div>
  )
}
