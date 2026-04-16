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
 * 부모 루틴 RSC — 로그인한 부모의 세션(RLS)으로 `missions` 목록을 조회합니다.
 *
 * 비개발자 설명:
 * - 이 조회는 "누가 로그인했는지"에 따라 결과가 달라집니다.
 * - 그래서 Next의 장기 캐시(`unstable_cache`) 안에서 쿠키 기반 클라이언트를 만들면
 *   런타임 환경에 따라 서버 에러가 날 수 있어, 부모 루틴은 매 요청 안전 조회로 유지합니다.
 * - 함수 시그니처(`parentUserId`)는 호출부 호환을 위해 그대로 둡니다.
 */
export async function getMissionTemplatesForParentRoutinePage(_parentUserId: string) {
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
}
