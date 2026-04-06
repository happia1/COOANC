/**
 * 부모 루틴 탭 — 서버 컴포넌트
 * 자녀 목록 + 전체 미션 조회 후 RoutineTab(Client)에 전달
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveDisplayAge } from '@/lib/ageFromBirthDate'
import {
  profileAgeGroupShortLabel,
  profileInstitutionLabel,
  resolveProfileAgeGroup,
} from '@/lib/childProfileDisplay'
import RoutineTab from '@/components/parent/RoutineTab'
import { selectChildProfilesByIds } from '@/lib/supabase/childProfileSelect'
import { getSeoulDateString } from '@/lib/koreaDate'
import type { Mission } from '@/types/database'

type TodayDailyMissionRow = {
  childId: string
  missionTemplateId: string
  isCompleted: boolean
}

export default async function RoutinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'parent') redirect('/home')

  const { data: links } = await supabase
    .from('family_links')
    .select('child_id')
    .eq('parent_id', user.id)

  const childIds = (links ?? []).map((l) => l.child_id)

  const todaySeoul = getSeoulDateString()

  const [profileBundle, statsRes, missionsRes, dailyTodayRes] = await Promise.all([
    childIds.length > 0 ? selectChildProfilesByIds(supabase, childIds) : Promise.resolve({ rows: [], error: null }),

    childIds.length > 0
      ? supabase
          .from('child_stats')
          .select('child_id, current_level, credits, hearts, streak_days')
          .in('child_id', childIds)
      : Promise.resolve({ data: [], error: null }),

    supabase
      .from('missions')
      .select('*')
      .order('level_required', { ascending: true })
      .order('created_at', { ascending: false }),

    childIds.length > 0
      ? supabase
          .from('daily_missions')
          .select('child_id, mission_template_id, is_completed')
          .in('child_id', childIds)
          .eq('date', todaySeoul)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (profileBundle.error) {
    console.error('[parent routine] profiles:', profileBundle.error.message)
  }
  if (dailyTodayRes.error) {
    console.error('[parent routine] daily_missions today:', dailyTodayRes.error.message)
  }
  const profiles = profileBundle.rows ?? []
  type StatRow = {
    child_id: string
    current_level: number
    credits: number
    hearts: number
    streak_days: number
  }
  const statsMap = Object.fromEntries(
    ((statsRes.data ?? []) as StatRow[]).map((s) => [s.child_id, s]),
  )

  const todayDailyMissions: TodayDailyMissionRow[] = (dailyTodayRes.data ?? []).map((r) => ({
    childId: String((r as { child_id: string }).child_id),
    missionTemplateId: String((r as { mission_template_id: string }).mission_template_id),
    isCompleted: Boolean((r as { is_completed: boolean }).is_completed),
  }))

  const children = profiles.map((p) => {
    const st = statsMap[p.id]
    const displayAge = resolveDisplayAge(p.birth_date ?? null, p.age)
    const ag = resolveProfileAgeGroup(p.age_group, displayAge)
    return {
      id: p.id,
      name: p.name,
      level: st?.current_level ?? 0,
      credits: st?.credits ?? 0,
      hearts: st?.hearts ?? 0,
      streakDays: st?.streak_days ?? 0,
      age: displayAge,
      avatarUrl: p.avatar_url ?? null,
      /** 온보딩과 동일: 'home'이 아니면 등원 칩·하원 시각을 씁니다 */
      institutionType: p.institution_type ?? null,
      ageGroupLabel: profileAgeGroupShortLabel(ag),
      childcareLabel: profileInstitutionLabel(ag, p.institution_type),
    }
  })

  return (
    <RoutineTab
      missions={(missionsRes.data ?? []) as Mission[]}
      children={children}
      todayDailyMissions={todayDailyMissions}
    />
  )
}
