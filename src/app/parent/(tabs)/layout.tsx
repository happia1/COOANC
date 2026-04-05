import type { ReactNode } from 'react'
import ParentNavBar from '@/components/parent/ParentNavBar'
import ParentTopBar from '@/components/parent/ParentTopBar'

export default function ParentTabsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50 flex flex-col">
      {/* 공통 상단바 — 모든 탭에 노출 */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="w-full max-w-md mx-auto px-4 py-3">
          <ParentTopBar />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto w-full max-w-md mx-auto px-4 pt-4 pb-24">
        {children}
      </main>
      <ParentNavBar />
    </div>
  )
}
