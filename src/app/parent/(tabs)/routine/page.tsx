/**
 * 부모 루틴 탭 — 서버 컴포넌트
 * 자녀 목록 + 전체 미션 조회 후 RoutineTab(Client)에 전달
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import RoutineTab from '@/components/parent/RoutineTab'
import type { Mission } from '@/types/database'

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

  const [profilesRes, statsRes, missionsRes] = await Promise.all([
    childIds.length > 0
      ? supabase.from('profiles').select('id, name').in('id', childIds)
      : Promise.resolve({ data: [], error: null }),

    childIds.length > 0
      ? supabase.from('child_stats').select('child_id, current_level').in('child_id', childIds)
      : Promise.resolve({ data: [], error: null }),

    supabase
      .from('missions')
      .select('*')
      .order('level_required', { ascending: true })
      .order('created_at', { ascending: false }),
  ])

  const profiles = (profilesRes.data ?? []) as { id: string; name: string }[]
  const statsMap = Object.fromEntries(
    ((statsRes.data ?? []) as { child_id: string; current_level: number }[]).map((s) => [s.child_id, s.current_level])
  )

  const children = profiles.map((p) => ({
    id: p.id,
    name: p.name,
    level: statsMap[p.id] ?? 0,
  }))

  return (
    <RoutineTab
      missions={(missionsRes.data ?? []) as Mission[]}
      children={children}
    />
  )
}
