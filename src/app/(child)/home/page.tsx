/**
 * 아이 앱 홈 탭 — 서버 컴포넌트
 * - Supabase Auth로 현재 사용자 확인
 * - child_stats, child_badges, badges 조회 후 HomeTab에 전달
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import HomeTab from '@/components/child/HomeTab'
import type { ChildStats, BadgeRow } from '@/types/database'

export default async function ChildHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-5">
        <span className="text-7xl">🔐</span>
        <div className="text-center space-y-1">
          <p className="font-bold text-brand-text text-lg">로그인이 필요해요!</p>
          <p className="text-sm text-gray-400">부모님과 함께 로그인해 주세요</p>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <Link
            href="/login"
            className="w-full text-center bg-brand-blue hover:bg-blue-600 text-white font-bold py-3 rounded-2xl shadow-md transition-all active:scale-95"
          >
            로그인
          </Link>
          <Link
            href="/signup"
            className="w-full text-center bg-white border-2 border-brand-green text-brand-green font-bold py-3 rounded-2xl transition-all active:scale-95"
          >
            회원가입
          </Link>
        </div>
      </div>
    )
  }

  // 병렬 조회
  const [statsRes, profileRes, earnedRes, badgesRes] = await Promise.all([
    supabase
      .from('child_stats')
      .select('*')
      .eq('child_id', user.id)
      .maybeSingle(),

    supabase
      .from('profiles')
      .select('name, role')
      .eq('id', user.id)
      .maybeSingle(),

    supabase
      .from('child_badges')
      .select('badge_id')
      .eq('child_id', user.id),

    supabase
      .from('badges')
      .select('badge_id, name, description, icon_emoji, badge_type, condition')
      .in('badge_type', ['level', 'streak'])
      .order('badge_type', { ascending: true })
      .limit(8),
  ])

  const initialStats   = (statsRes.data   ?? null) as ChildStats | null
  const displayBadges  = (badgesRes.data   ?? [])   as BadgeRow[]
  const earnedBadgeIds = (earnedRes.data   ?? []).map(b => b.badge_id)

  // 레이아웃에서 부모는 redirect 되지만, 페이지 단에서도 한 번 더 막음
  if (profileRes.data?.role === 'parent') {
    redirect('/parent')
  }

  // 표시 이름: DB profiles 우선, 없으면 가입 시 넣은 user_metadata.name (자녀 계정)
  const meta = user.user_metadata as { name?: string } | undefined
  const childName =
    profileRes.data?.name?.trim() ||
    (typeof meta?.name === 'string' ? meta.name.trim() : '') ||
    '쿠앵이'

  return (
    <HomeTab
      childId={user.id}
      initialStats={initialStats}
      displayBadges={displayBadges}
      earnedBadgeIds={earnedBadgeIds}
      childName={childName}
    />
  )
}
