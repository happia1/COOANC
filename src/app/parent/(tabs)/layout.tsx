import type { ReactNode } from 'react'
import ParentNavBar from '@/components/parent/ParentNavBar'
import ParentTopBar from '@/components/parent/ParentTopBar'
import ParentNewPurchaseRequestModal from '@/components/parent/ParentNewPurchaseRequestModal'
import ParentStickerBoardCompleteModal from '@/components/parent/ParentStickerBoardCompleteModal'

export default async function ParentTabsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50 flex flex-col">
      <ParentTopBar />
      <main className="flex-1 overflow-y-auto w-full max-w-md mx-auto px-4 pt-4 pb-24">
        {children}
      </main>
      <ParentNewPurchaseRequestModal />
      <ParentStickerBoardCompleteModal />
      <ParentNavBar />
    </div>
  )
}
