import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function ParentHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 부모 프로필
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'parent') redirect('/home')

  // 자녀 목록 조회
  const { data: links } = await supabase
    .from('family_links')
    .select('child_id')
    .eq('parent_id', user.id)

  const childIds = (links ?? []).map(l => l.child_id)

  const { data: children } = childIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, name')
        .in('id', childIds)
    : { data: [] }

  const { data: stats } = childIds.length > 0
    ? await supabase
        .from('child_stats')
        .select('child_id, credits, current_level, streak_days')
        .in('child_id', childIds)
    : { data: [] }

  const statsMap = Object.fromEntries((stats ?? []).map(s => [s.child_id, s]))

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-green-50">
      <div className="w-full max-w-md mx-auto px-4 pt-8 pb-10">

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Image src="/COOANC_Logo.png" alt="COOANC" width={36} height={36} className="rounded-xl" />
            <span className="text-lg font-black text-brand-blue">COOANC</span>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">안녕하세요</p>
            <p className="text-sm font-bold text-brand-text">{profile?.name ?? '부모님'}</p>
          </div>
        </div>

        {/* 자녀 카드 목록 */}
        <h2 className="text-base font-bold text-brand-text mb-3">우리 아이들</h2>

        {(children ?? []).length === 0 ? (
          <div className="bg-white rounded-3xl shadow p-6 text-center text-sm text-gray-400">
            <p className="mb-3">아직 등록된 자녀가 없어요.</p>
            <Link
              href="/onboarding"
              className="inline-block bg-brand-green text-white font-bold px-5 py-2.5 rounded-2xl text-sm shadow transition-all active:scale-95"
            >
              자녀 등록하기 🐣
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {(children ?? []).map(child => {
              const s = statsMap[child.id]
              return (
                <div
                  key={child.id}
                  className="bg-white rounded-3xl shadow-md px-5 py-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">🐣</span>
                    <div>
                      <p className="font-bold text-brand-text">{child.name}</p>
                      <p className="text-xs text-gray-400">
                        Lv.{s?.current_level ?? 0} · 🔥 {s?.streak_days ?? 0}일
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-brand-blue">{s?.credits ?? 0}</p>
                    <p className="text-[11px] text-gray-400">크레딧</p>
                  </div>
                </div>
              )
            })}

            <Link
              href="/onboarding"
              className="mt-1 text-center text-sm text-brand-blue font-bold underline underline-offset-2"
            >
              + 자녀 추가하기
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
