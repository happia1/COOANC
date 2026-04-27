import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import type { Mission } from '@/types/database'

/**
 * 자녀 미션 RSC — `missions` 미션 템플릿 전체 조회
 *
 * 비개발자 설명:
 * - 예전에는 Next `unstable_cache`(60초)로 목록을 잠깐 저장했다가, 부모가 루틴을 갈아엎은 직후
 *   **이미 지워진 카드 id**로 오늘 일정을 채우려다 실패하는 문제가 있었습니다.
 * - 그래서 **캐시 없이** 요청마다 DB에서 바로 읽습니다(자녀 홈·미션 탭이 항상 최신 템플릿을 봅니다).
 */
export async function getMissionTemplatesForChildMissionPage() {
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
