/**
 * 부모 승인 탭 — 구매 요청 승인/반려 + 미션 롤백
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ApprovalTab from '@/components/parent/ApprovalTab'

export default async function ApprovalPage() {
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

  const { data: links } = await supabase
    .from('family_links')
    .select('child_id')
    .eq('parent_id', user.id)

  const childIds = (links ?? []).map((l) => l.child_id)

  // 자녀 이름 맵
  const { data: childProfiles } = childIds.length > 0
    ? await supabase.from('profiles').select('id, name').in('id', childIds)
    : { data: [] }

  const childNameMap = Object.fromEntries(
    ((childProfiles ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]),
  )

  const [requestsRes, logsRes] = await Promise.all([
    // 대기 중인 구매 요청
    childIds.length > 0
      ? supabase
          .from('purchase_requests')
          .select('*')
          .in('child_id', childIds)
          .eq('status', 'pending')
          .order('requested_at', { ascending: true })
      : Promise.resolve({ data: [] }),

    // 최근 완료 미션 (롤백 가능)
    childIds.length > 0
      ? supabase
          .from('mission_logs')
          .select('id, child_id, assigned_date, completed_at, credit_earned, heart_earned, exp_earned, missions(title, icon_emoji)')
          .in('child_id', childIds)
          .eq('is_completed', true)
          .order('completed_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
  ])

  return (
    <ApprovalTab
      pendingRequests={requestsRes.data ?? []}
      recentLogs={logsRes.data ?? []}
      childNameMap={childNameMap}
    />
  )
}
