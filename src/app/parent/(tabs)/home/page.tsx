/**
 * 부모 홈 탭 — 서버 컴포넌트
 * 전체 자녀 데이터를 한번에 조회 후 HomeTab(Client)에 전달
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveDisplayAge } from '@/lib/ageFromBirthDate'
import { selectChildProfilesByIds } from '@/lib/supabase/childProfileSelect'
import { getSeoulDateString } from '@/lib/koreaDate'
import HomeTab, { type ChildSummary } from '@/components/parent/HomeTab'

export default async function ParentHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'parent') redirect('/home')

  const { data: links } = await supabase
    .from('family_links')
    .select('child_id')
    .eq('parent_id', user.id)

  const childIds = (links ?? []).map((l) => l.child_id)

  if (childIds.length === 0) {
    return (
      <HomeTab
        childrenData={[]}
        pendingCount={0}
      />
    )
  }

  const today = getSeoulDateString()

  const { rows: profileRows, error: profilesFetchErr } = await selectChildProfilesByIds(supabase, childIds)
  if (profilesFetchErr) {
    console.error('[parent home] profiles:', profilesFetchErr.message)
  }
  const profiles = profileRows ?? []

  const [statsRes, todayLogsRes, recentLogsRes, missionsRes, pendingRes] = await Promise.all([
    supabase
      .from('child_stats')
      .select('child_id, credits, hearts, current_level, exp, exp_to_next_level, streak_days, eq_delay_score, eq_routine_rate, eq_save_ratio')
      .in('child_id', childIds),

    supabase
      .from('mission_logs')
      .select('child_id, is_completed')
      .in('child_id', childIds)
      .eq('assigned_date', today)
      .eq('is_completed', true),

    supabase
      .from('mission_logs')
      .select('child_id, completed_at, credit_earned, missions(title, icon_emoji)')
      .in('child_id', childIds)
      .eq('is_completed', true)
      .order('completed_at', { ascending: false })
      .limit(30),

    supabase.from('missions').select('id, level_required, linked_child_id').eq('is_active', true),

    supabase
      .from('purchase_requests')
      .select('id', { count: 'exact', head: true })
      .in('child_id', childIds)
      .eq('status', 'pending'),
  ])
  const statsMap = Object.fromEntries(
    ((statsRes.data ?? []) as { child_id: string; [key: string]: unknown }[]).map((s) => [s.child_id, s])
  )
  const missions = (missionsRes.data ?? []) as {
    id: string
    level_required: number
    linked_child_id: string | null
  }[]

  // 오늘 완료 수: child_id별 집계
  const todayCompletedMap: Record<string, number> = {}
  for (const log of todayLogsRes.data ?? []) {
    const cid = (log as { child_id: string }).child_id
    todayCompletedMap[cid] = (todayCompletedMap[cid] ?? 0) + 1
  }

  // 최근 활동: child_id별 분류 (최대 5개)
  type RawLog = { child_id: string; completed_at: string | null; credit_earned: number; missions: { title: string; icon_emoji: string } | null }
  const recentMap: Record<string, RawLog[]> = {}
  for (const log of (recentLogsRes.data ?? []) as unknown as RawLog[]) {
    if (!recentMap[log.child_id]) recentMap[log.child_id] = []
    if (recentMap[log.child_id].length < 5) recentMap[log.child_id].push(log)
  }

  const pendingCount = (pendingRes as unknown as { count: number | null }).count ?? 0

  // ChildSummary 조합
  const childrenData: ChildSummary[] = profiles.map((p) => {
    const stats = statsMap[p.id] as unknown as ChildSummary['stats'] | undefined
    const level = stats?.current_level ?? 0
    const totalMissions = missions.filter(
      (m) =>
        m.level_required <= level &&
        (m.linked_child_id == null || m.linked_child_id === p.id),
    ).length

    return {
      id: p.id,
      name: p.name,
      age: resolveDisplayAge(p.birth_date ?? null, p.age),
      avatarUrl: p.avatar_url ?? null,
      stats: stats ?? null,
      todayCompleted: todayCompletedMap[p.id] ?? 0,
      totalMissions,
      recentActivity: (recentMap[p.id] ?? []).map((log) => ({
        missionTitle: log.missions?.title ?? '미션',
        missionEmoji: log.missions?.icon_emoji ?? '⭐',
        completedAt: log.completed_at ?? '',
        creditEarned: log.credit_earned,
      })),
    }
  })

  return (
    <HomeTab
      childrenData={childrenData}
      pendingCount={pendingCount}
    />
  )
}
