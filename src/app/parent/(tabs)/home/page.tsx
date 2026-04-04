/**
 * 부모 홈 탭 — 자녀 모니터링 대시보드
 */
import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AUTH_LOGO_SRC } from '@/constants/branding'

const LEVEL_NAMES = ['씨앗', '새싹', '교환사', '저축왕', '나눔이', '투자가']

export default async function ParentHomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'parent') redirect('/home')

  // 자녀 목록
  const { data: links } = await supabase
    .from('family_links')
    .select('child_id')
    .eq('parent_id', user.id)

  const childIds = (links ?? []).map((l) => l.child_id)

  const [profilesRes, statsRes, logsRes, pendingRes] = await Promise.all([
    childIds.length > 0
      ? supabase.from('profiles').select('id, name, age').in('id', childIds)
      : Promise.resolve({ data: [] }),

    childIds.length > 0
      ? supabase
          .from('child_stats')
          .select('child_id, credits, hearts, current_level, exp, exp_to_next_level, streak_days, eq_delay_score, eq_routine_rate, eq_save_ratio')
          .in('child_id', childIds)
      : Promise.resolve({ data: [] }),

    // 최근 미션 완료 로그 (홈 활동 피드)
    childIds.length > 0
      ? supabase
          .from('mission_logs')
          .select('id, child_id, mission_id, completed_at, credit_earned, missions(title, icon_emoji)')
          .in('child_id', childIds)
          .eq('is_completed', true)
          .order('completed_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),

    // 미승인 구매 요청 수
    childIds.length > 0
      ? supabase
          .from('purchase_requests')
          .select('id', { count: 'exact', head: true })
          .in('child_id', childIds)
          .eq('status', 'pending')
      : Promise.resolve({ count: 0 }),
  ])

  const children = (profilesRes.data ?? []) as { id: string; name: string; age: number | null }[]
  const statsMap = Object.fromEntries(
    ((statsRes.data ?? []) as { child_id: string; [key: string]: unknown }[]).map((s) => [s.child_id, s]),
  )
  const recentLogs = (logsRes.data ?? []) as {
    id: string
    child_id: string
    completed_at: string
    credit_earned: number
    missions: { title: string; icon_emoji: string } | null
  }[]
  const pendingCount = (pendingRes as { count: number | null }).count ?? 0

  const childNameMap = Object.fromEntries(children.map((c) => [c.id, c.name]))

  return (
    <div className="flex flex-col gap-5">

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image
            src={AUTH_LOGO_SRC}
            alt="COOANC"
            width={32}
            height={32}
            className="rounded-xl"
            style={{ height: 'auto' }}
          />
          <span className="text-lg font-black text-brand-blue">COOANC</span>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">안녕하세요</p>
          <p className="text-sm font-bold text-brand-text">{profile?.name ?? '부모님'}</p>
        </div>
      </div>

      {/* 승인 대기 배너 */}
      {pendingCount > 0 && (
        <Link
          href="/parent/approval"
          className="flex items-center justify-between bg-amber-50 border-2 border-amber-300 rounded-2xl px-4 py-3 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">🛒</span>
            <div>
              <p className="text-sm font-bold text-amber-700">구매 요청 {pendingCount}건 대기 중</p>
              <p className="text-xs text-amber-500">탭하여 승인/반려하세요</p>
            </div>
          </div>
          <span className="text-amber-500 font-bold">→</span>
        </Link>
      )}

      {/* 자녀 카드 목록 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-brand-text">자녀 계정</h2>
          <Link href="/onboarding" className="text-xs text-brand-blue font-bold underline underline-offset-2">
            + 자녀 추가
          </Link>
        </div>

        {children.length === 0 ? (
          <div className="bg-white rounded-3xl shadow p-8 text-center">
            <p className="text-4xl mb-3">🐣</p>
            <p className="text-sm text-gray-400 mb-4">아직 등록된 자녀가 없어요.</p>
            <Link
              href="/onboarding"
              className="inline-block bg-brand-green text-white font-bold px-5 py-2.5 rounded-2xl text-sm shadow transition-all active:scale-95"
            >
              자녀 등록하기
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {children.map((child) => {
              const s = statsMap[child.id] as {
                credits: number; hearts: number; current_level: number
                exp: number; exp_to_next_level: number; streak_days: number
                eq_delay_score: number; eq_routine_rate: number; eq_save_ratio: number
              } | undefined
              const level = s?.current_level ?? 0
              const expPct = s ? Math.min((s.exp / s.exp_to_next_level) * 100, 100) : 0

              return (
                <Link
                  key={child.id}
                  href={`/parent/child/${child.id}`}
                  className="block bg-white rounded-2xl shadow-sm p-4 border border-transparent hover:border-brand-blue/20 transition-all active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-blue/10 to-brand-green/10 flex items-center justify-center text-2xl flex-shrink-0">
                      🐣
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-brand-text">{child.name}</p>
                        <span className="text-xs bg-brand-blue/10 text-brand-blue font-bold px-2 py-0.5 rounded-full">
                          Lv.{level} {LEVEL_NAMES[level]}
                        </span>
                      </div>
                      {child.age && (
                        <p className="text-xs text-gray-400">{child.age}세</p>
                      )}
                    </div>
                  </div>

                  {/* 스탯 행 */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <StatChip emoji="🪙" value={s?.credits ?? 0} label="크레딧" />
                    <StatChip emoji="❤️" value={s?.hearts ?? 0} label="하트" />
                    <StatChip emoji="🔥" value={`${s?.streak_days ?? 0}일`} label="연속" />
                  </div>

                  {/* EXP 게이지 */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] text-gray-400 font-bold">EXP</span>
                      <span className="text-[10px] text-gray-400 tabular-nums">
                        {s?.exp ?? 0}/{s?.exp_to_next_level ?? 100}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-green"
                        style={{ width: `${expPct}%` }}
                      />
                    </div>
                  </div>

                  {/* EQ 바 */}
                  {s && (
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <EqMini label="루틴" value={s.eq_routine_rate} color="bg-brand-blue" />
                      <EqMini label="만족지연" value={s.eq_delay_score} color="bg-brand-green" />
                      <EqMini label="저축" value={s.eq_save_ratio} color="bg-amber-400" />
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* 최근 활동 피드 */}
      {recentLogs.length > 0 && (
        <section>
          <h2 className="text-base font-bold text-brand-text mb-3">📋 최근 활동</h2>
          <div className="flex flex-col gap-2">
            {recentLogs.map((log) => (
              <div key={log.id} className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center gap-3">
                <span className="text-xl flex-shrink-0">
                  {log.missions?.icon_emoji ?? '⭐'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-brand-text truncate">
                    {log.missions?.title ?? '미션'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {childNameMap[log.child_id] ?? '자녀'} · {log.completed_at?.slice(0, 10)}
                  </p>
                </div>
                <span className="text-xs font-bold text-brand-blue flex-shrink-0">
                  +{log.credit_earned}🪙
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function StatChip({ emoji, value, label }: { emoji: string; value: number | string; label: string }) {
  return (
    <div className="bg-gray-50 rounded-xl px-2 py-1.5 text-center">
      <p className="text-sm font-black text-brand-text tabular-nums">{emoji} {value}</p>
      <p className="text-[9px] text-gray-400">{label}</p>
    </div>
  )
}

function EqMini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-[9px] text-gray-400">{label}</span>
        <span className="text-[9px] font-bold text-gray-500">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}
