'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

/**
 * 자녀 앱 상단바용 "나가기" 버튼 — teal pill 스타일
 * 클릭 시 로그아웃 후 /login 으로 이동
 */
export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={handleSignOut}
      className="inline-flex items-center rounded-full bg-teal-500 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-teal-600 active:bg-teal-700 transition-colors"
    >
      나가기
    </button>
  )
}
