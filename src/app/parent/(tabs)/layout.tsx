import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import ParentNavBar from '@/components/parent/ParentNavBar'
import ParentTopBar from '@/components/parent/ParentTopBar'

export default async function ParentTabsLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let parentName = '부모님'
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .maybeSingle()
    parentName = profile?.name?.trim() || '부모님'
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50 flex flex-col">
      <ParentTopBar parentName={parentName} />
      <main className="flex-1 overflow-y-auto w-full max-w-md mx-auto px-4 pt-4 pb-24">
        {children}
      </main>
      <ParentNavBar />
    </div>
  )
}
