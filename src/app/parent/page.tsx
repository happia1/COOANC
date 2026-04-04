import { redirect } from 'next/navigation'
import Image from 'next/image'
import { AUTH_LOGO_SRC } from '@/constants/branding'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const isDev = process.env.NODE_ENV === 'development'

export default async function ParentHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 부모 프로필
  const {
    data: profile,
    error: profileErr,
  } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileErr && isDev) {
    console.warn('[parent] profiles(본인) error:', profileErr.message)
  }

  if (profile?.role !== 'parent') redirect('/home')

  // 자녀 목록: 스키마에는 children 테이블이 없고 family_links + profiles 로 연결됨
  const {
    data: links,
    error: linksErr,
  } = await supabase
    .from('family_links')
    .select('child_id')
    .eq('parent_id', user.id)

  if (isDev) {
    console.log('[parent] user.id', user.id)
    console.log('[parent] family_links rows:', links?.length ?? 0, linksErr ? linksErr.message : 'ok')
  }

  const childIds = (links ?? []).map(l => l.child_id)

  const {
    data: children,
    error: childrenProfilesErr,
  } = childIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, name')
        .in('id', childIds)
    : { data: [], error: null }

  if (isDev) {
    console.log('[parent] childIds from links:', childIds)
    console.log(
      '[parent] profiles(자녀) rows:',
      children?.length ?? 0,
      childrenProfilesErr ? childrenProfilesErr.message : 'ok',
    )
  }

  // (디버그) children 테이블이 프로젝트에 있으면 결과 확인 — 없으면 PostgREST 에러가 찍힘
  if (isDev) {
    const probe = await supabase.from('children').select('*').limit(5)
    console.log(
      '[parent] supabase.from("children").select("*") [프로젝트에 테이블 없을 수 있음]',
      {
        rowCount: probe.data?.length ?? 0,
        error: probe.error?.message ?? null,
      },
    )
  }

  const {
    data: stats,
    error: statsErr,
  } = childIds.length > 0
    ? await supabase
        .from('child_stats')
        .select('child_id, credits, current_level, streak_days')
        .in('child_id', childIds)
    : { data: [], error: null }

  if (isDev && statsErr) {
    console.warn('[parent] child_stats error:', statsErr.message)
  }

  const statsMap = Object.fromEntries((stats ?? []).map(s => [s.child_id, s]))

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-green-50">
      <div className="w-full max-w-md mx-auto px-4 pt-8 pb-10">

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Image src={AUTH_LOGO_SRC} alt="COOANC" width={36} height={36} className="rounded-xl" style={{ height: 'auto' }} />
            <span className="text-lg font-black text-brand-blue">COOANC</span>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">안녕하세요</p>
            <p className="text-sm font-bold text-brand-text">{profile?.name ?? '부모님'}</p>
          </div>
        </div>

        {/* 자녀 카드 목록 */}
        <h2 className="text-base font-bold text-brand-text mb-3">자녀 계정</h2>

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
                // 카드 전체를 누르면 해당 자녀의 상세 화면으로 이동합니다.
                <Link
                  key={child.id}
                  href={`/parent/child/${child.id}`}
                  className="flex w-full items-center justify-between bg-white rounded-3xl shadow-md px-5 py-4 transition hover:shadow-lg active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
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
                </Link>
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
