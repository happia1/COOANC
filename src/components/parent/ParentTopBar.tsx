import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AUTH_LOGO_SRC } from '@/constants/branding'

/**
 * 부모 앱 공통 상단바 — 모든 탭에 노출
 * - 좌: 브랜드 로고
 * - 우: 퍼플 프로필 칩(부모 이름) + 설정 아이콘
 */
export default async function ParentTopBar() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let parentName = '부모님'
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .maybeSingle()
    parentName = profile?.name ?? '부모님'
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

      {/* 우측: 퍼플 프로필 칩 + 설정 */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700">
          👤 {parentName}
        </span>
        <Link
          href="/settings"
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
        >
          <span className="text-base">⚙️</span>
        </Link>
      </div>
    </div>
  )
}
