/**
 * 부모 루틴 탭 — 미션 카드 생성 · 관리
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import RoutineTab from '@/components/parent/RoutineTab'
import type { Mission } from '@/types/database'

export default async function RoutinePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'parent') redirect('/home')

  const { data: missions } = await supabase
    .from('missions')
    .select('*')
    .order('level_required', { ascending: true })
    .order('created_at', { ascending: false })

  return <RoutineTab missions={(missions ?? []) as Mission[]} />
}
