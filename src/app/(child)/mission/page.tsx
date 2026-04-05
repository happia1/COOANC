/**
 * 아이 앱 미션 탭 — 서버 컴포넌트
 * - 오늘 날짜 기준 mission_logs 조회
 * - 없으면 active 미션 목록을 보여줌
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MissionTab from '@/components/child/MissionTab'
import type { Mission, MissionLog } from '@/types/database'

export default async function MissionPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  const [statsRes, missionsRes, logsRes] = await Promise.all([
    supabase
      .from('child_stats')
      .select('credits, current_level, streak_days')
      .eq('child_id', user.id)
      .maybeSingle(),

    supabase
      .from('missions')
      .select('*')
      .eq('is_active', true)
      .order('scheduled_time', { ascending: true, nullsFirst: false }),

    supabase
      .from('mission_logs')
      .select('*')
      .eq('child_id', user.id)
      .eq('assigned_date', today),
  ])

  const level = statsRes.data?.current_level ?? 0
  const credits = statsRes.data?.credits ?? 0
  const streak = statsRes.data?.streak_days ?? 0

  // 레벨 이하 미션만 표시
  const missions = ((missionsRes.data ?? []) as Mission[]).filter(
    (m) => m.level_required <= level,
  )

  // 오늘 완료된 미션 ID 집합
  const completedIds = new Set(
    ((logsRes.data ?? []) as MissionLog[])
      .filter((l) => l.is_completed)
      .map((l) => l.mission_id),
  )

  return (
    <MissionTab
      childId={user.id}
      missions={missions}
      completedIds={[...completedIds]}
      credits={credits}
      streak={streak}
      today={today}
    />
  )
}
