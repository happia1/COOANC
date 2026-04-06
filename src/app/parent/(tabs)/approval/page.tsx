/**
 * 부모 승인 탭 — 구매 요청 승인/반려 + 미션 롤백 + 자녀 마켓 메뉴 제어
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ApprovalTab from '@/components/parent/ApprovalTab'
import { selectChildProfilesByIds } from '@/lib/supabase/childProfileSelect'
import { resolveDisplayAge } from '@/lib/ageFromBirthDate'
import {
  profileAgeGroupShortLabel,
  profileInstitutionLabel,
  resolveProfileAgeGroup,
} from '@/lib/childProfileDisplay'
import type { StoreItem } from '@/types/database'

export default async function ApprovalPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()

  if (profile?.role !== 'parent') redirect('/home')

  const { data: links } = await supabase.from('family_links').select('id, child_id').eq('parent_id', user.id)

  const childIds = (links ?? []).map((l) => l.child_id)
  const linkByChild = Object.fromEntries((links ?? []).map((l) => [l.child_id, l.id]))
  const linkIds = (links ?? []).map((l) => l.id)

  const profileBundle = childIds.length > 0 ? await selectChildProfilesByIds(supabase, childIds) : { rows: [], error: null }
  if (profileBundle.error) {
    console.error('[parent approval] profiles:', profileBundle.error.message)
  }
  const profiles = profileBundle.rows ?? []

  const [statsRes, requestsRes, logsRes, storeRes, hiddenRes] = await Promise.all([
    childIds.length > 0
      ? supabase
          .from('child_stats')
          .select('child_id, current_level, credits, hearts, streak_days')
          .in('child_id', childIds)
      : Promise.resolve({ data: [], error: null }),

    childIds.length > 0
      ? supabase
          .from('purchase_requests')
          .select('*')
          .in('child_id', childIds)
          .eq('status', 'pending')
          .order('requested_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),

    childIds.length > 0
      ? supabase
          .from('mission_logs')
          .select('id, child_id, assigned_date, completed_at, credit_earned, heart_earned, exp_earned, missions(title, icon_emoji)')
          .in('child_id', childIds)
          .eq('is_completed', true)
          .order('completed_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [], error: null }),

    (async () => {
      if (linkIds.length === 0) {
        return supabase.from('store_items').select('*').eq('is_active', true).is('family_link_id', null)
      }
      return supabase
        .from('store_items')
        .select('*')
        .eq('is_active', true)
        .or(`family_link_id.is.null,family_link_id.in.(${linkIds.join(',')})`)
    })(),

    childIds.length > 0
      ? supabase.from('child_market_hidden_items').select('child_id, store_item_id').in('child_id', childIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  type StatRow = {
    child_id: string
    current_level: number
    credits: number
    hearts: number
    streak_days: number
  }
  const statsMap = Object.fromEntries(((statsRes.data ?? []) as StatRow[]).map((s) => [s.child_id, s]))

  const childrenProfiles = profiles.map((p) => {
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
      institutionType: p.institution_type ?? null,
      ageGroupLabel: profileAgeGroupShortLabel(ag),
      childcareLabel: profileInstitutionLabel(ag, p.institution_type),
    }
  })

  const hiddenItemIdsByChild: Record<string, string[]> = {}
  for (const cid of childIds) {
    hiddenItemIdsByChild[cid] = []
  }
  if (!hiddenRes.error && hiddenRes.data) {
    for (const row of hiddenRes.data as { child_id: string; store_item_id: string }[]) {
      if (!hiddenItemIdsByChild[row.child_id]) hiddenItemIdsByChild[row.child_id] = []
      hiddenItemIdsByChild[row.child_id].push(row.store_item_id)
    }
  } else if (hiddenRes.error) {
    console.warn('[parent approval] child_market_hidden_items:', hiddenRes.error.message)
  }

  const storeItems = (storeRes.data ?? []) as StoreItem[]

  return (
    <ApprovalTab
      childrenProfiles={childrenProfiles}
      pendingRequests={requestsRes.data ?? []}
      recentLogs={logsRes.data ?? []}
      storeItems={storeItems}
      linkByChild={linkByChild}
      hiddenItemIdsByChild={hiddenItemIdsByChild}
    />
  )
}
