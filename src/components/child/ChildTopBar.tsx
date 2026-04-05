import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { AUTH_LOGO_SRC } from '@/constants/branding'
import SignOutButton from './SignOutButton'

/**
 * 자녀 앱 공통 상단바 — 모든 탭에 노출
 * - 좌: 브랜드 로고
 * - 우: teal 프로필 칩(자녀 이름) + teal "나가기" 버튼
 */
export default async function ChildTopBar() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let childName = '친구'
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .maybeSingle()
    childName = profile?.name ?? '친구'
  }

  return (
    <div className="flex items-center justify-between gap-2">
      {/* 브랜드 로고 */}
      <div className="flex min-w-0 flex-1 items-center">
        <Image
          src={AUTH_LOGO_SRC}
          alt="COOANC"
          width={180}
          height={180}
          className="h-auto max-h-[min(180px,42vw)] w-auto max-w-[min(180px,52vw)] rounded-2xl object-contain"
          style={{ height: 'auto' }}
          priority
        />
      </div>

      {/* 우측: teal 프로필 칩 + 나가기 버튼 */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-700">
          🐣 {childName}
        </span>
        <SignOutButton />
      </div>
    </div>
  )
}
