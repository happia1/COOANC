import type { ReactNode } from 'react'
import ParentNavBar from '@/components/parent/ParentNavBar'

export default function ParentTabsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50 flex flex-col">
      <main className="flex-1 overflow-y-auto w-full max-w-md mx-auto px-4 pt-6 pb-24">
        {children}
      </main>
      <ParentNavBar />
    </div>
  )
}
