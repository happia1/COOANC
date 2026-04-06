/**
 * 부모 홈 탭 — 서버 컴포넌트
 * 전체 자녀 데이터를 한번에 조회 후 HomeTab(Client)에 전달합니다.
 *
 * 「오늘 미션 달성률」은 자녀 앱「오늘의 미션」과 같이,
 * **그날짜(date)로 배정된 daily_missions 행 전부**를 분모로 씁니다.
 * (오전·오후·스페셜 등 당일 생성·배정된 카드가 빠지지 않도록 블록별 필터는 두지 않습니다.)
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveDisplayAge } from '@/lib/ageFromBirthDate'
import {
  profileAgeGroupShortLabel,
  profileInstitutionLabel,
  resolveProfileAgeGroup,
} from '@/lib/childProfileDisplay'
import { selectChildProfilesByIds } from '@/lib/supabase/childProfileSelect'
import { addSeoulCalendarDays, getSeoulDateString } from '@/lib/koreaDate'
import { buildWeeklyRoutineDays, type DailyMissionCompletionRow } from '@/lib/childWeeklyRoutine'
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
  const weekStart = addSeoulCalendarDays(today, -6)

  const { rows: profileRows, error: profilesFetchErr } = await selectChildProfilesByIds(supabase, childIds)
  if (profilesFetchErr) {
    console.error('[parent home] profiles:', profilesFetchErr.message)
  }
  const profiles = profileRows ?? []

  const [statsRes, todayDailyRes, weekDailyRes, recentLogsRes, pendingRes] = await Promise.all([
    supabase
      .from('child_stats')
      .select('child_id, credits, hearts, current_level, exp, exp_to_next_level, streak_days, eq_delay_score, eq_routine_rate, eq_save_ratio')
      .in('child_id', childIds),

    // 당일 배정된 카드 전부(자녀 앱 MissionTab 의 total 과 동일한 기준)
    supabase
      .from('daily_missions')
      .select('child_id, is_completed')
      .in('child_id', childIds)
      .eq('date', today),

    // 경제 EQ 카드 — 요일별 막대용 최근 7일(서울) 배정 미션
    supabase
      .from('daily_missions')
      .select('child_id, date, is_completed')
      .in('child_id', childIds)
      .gte('date', weekStart)
      .lte('date', today),

    supabase
      .from('mission_logs')
      .select('child_id, completed_at, credit_earned, missions(title, icon_emoji)')
      .in('child_id', childIds)
      .eq('is_completed', true)
      .order('completed_at', { ascending: false })
      .limit(30),

    supabase
      .from('purchase_requests')
      .select('id', { count: 'exact', head: true })
      .in('child_id', childIds)
      .eq('status', 'pending'),
  ])
  const statsMap = Object.fromEntries(
    ((statsRes.data ?? []) as { child_id: string; [key: string]: unknown }[]).map((s) => [s.child_id, s])
  )

  // 자녀별: 오늘 날짜 daily_missions 전체 개수·완료 개수(오전/오후/스페셜 등 구분 없이 한 번에 집계)
  const todayProgressMap: Record<string, { total: number; completed: number }> = {}
  for (const cid of childIds) todayProgressMap[cid] = { total: 0, completed: 0 }
  for (const row of (todayDailyRes.data ?? []) as { child_id: string; is_completed: boolean }[]) {
    const acc = todayProgressMap[row.child_id]
    if (!acc) continue
    acc.total += 1
    if (row.is_completed) acc.completed += 1
  }

  // 자녀별 최근 7일 daily_missions → 요일 막대 데이터
  const weekRowsByChild: Record<string, DailyMissionCompletionRow[]> = {}
  for (const cid of childIds) weekRowsByChild[cid] = []
  for (const row of (weekDailyRes.data ?? []) as {
    child_id: string
    date: string
    is_completed: boolean
  }[]) {
    const bucket = weekRowsByChild[row.child_id]
    if (!bucket) continue
    bucket.push({ date: row.date, is_completed: row.is_completed })
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
    const prog = todayProgressMap[p.id] ?? { total: 0, completed: 0 }

    const displayAge = resolveDisplayAge(p.birth_date ?? null, p.age)
    const ag = resolveProfileAgeGroup(p.age_group, displayAge)

    return {
      id: p.id,
      name: p.name,
      age: displayAge,
      ageGroupLabel: profileAgeGroupShortLabel(ag),
      childcareLabel: profileInstitutionLabel(ag, p.institution_type),
      avatarUrl: p.avatar_url ?? null,
      stats: stats ?? null,
      weeklyRoutine: buildWeeklyRoutineDays(today, weekRowsByChild[p.id] ?? []),
      todayCompleted: prog.completed,
      totalMissions: prog.total,
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
