import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/admin'

export async function undoDailyMission(childId: string, dailyId: string, version: number, requestId: string, recentOnly: boolean) {
  const db = createServiceRoleClient()
  if (!db) throw new Error('보상 서버 설정을 확인해 주세요')
  const { data, error } = await db.rpc('apply_daily_mission_action', {
    p_child_id: childId, p_daily_id: dailyId, p_request_id: requestId,
    p_version: version, p_undo: true, p_recent_only: recentOnly,
  })
  if (error) throw new Error(error.message)
  return data
}
