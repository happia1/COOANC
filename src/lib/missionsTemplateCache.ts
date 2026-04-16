import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import type { Mission } from '@/types/database'

/**
 * 자녀 미션 RSC — `missions` 미션 템플릿 전체 조회
 * - 자주 바뀌지 않는 마스터 데이터이므로 60초마다만 서버에서 다시 읽습니다.
 * - `child_stats`·`daily_missions` 등 실시간에 가까운 데이터는 페이지에서 그대로 매 요청 조회합니다.
 */
const getMissionTemplatesChildRscInner = unstable_cache(
  async () => {
    const missionDb = createServiceRoleClient()
    if (!missionDb) {
      return { data: null as Mission[] | null, error: { message: 'no_service_role' as const } }
    }
    const res = await missionDb
      .from('missions')
      .select('*')
      .order('scheduled_time', { ascending: true, nullsFirst: false })
    return {
      data: (res.data ?? null) as Mission[] | null,
      error: res.error ? { message: res.error.message } : null,
    }
  },
  ['missions-templates-child-rsc'],
  { revalidate: 60 },
)

export async function getMissionTemplatesForChildMissionPage() {
  return getMissionTemplatesChildRscInner()
}

/**
 * 부모 루틴 RSC — 로그인한 부모별로 RLS 가 적용된 `missions` 목록
 * - 캐시 키에 부모 user id 를 넣어 다른 계정과 섞이지 않게 합니다.
 */
export function getMissionTemplatesForParentRoutinePage(parentUserId: string) {
  return unstable_cache(
    async () => {
      const supabase = await createClient()
      const res = await supabase
        .from('missions')
        .select('*')
        .order('level_required', { ascending: true })
        .order('created_at', { ascending: false })
      return {
        data: (res.data ?? null) as Mission[] | null,
        error: res.error ? { message: res.error.message } : null,
      }
    },
    ['parent-routine-missions', parentUserId],
    { revalidate: 60 },
  )()
}
