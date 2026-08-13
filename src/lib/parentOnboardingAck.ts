/**
 * 부모에게 「한 번만」 보여 주는 안내 팝업의 확인 상태 — **DB 기준**입니다.
 *
 * 비개발자 설명:
 * - 한 번 확인하면 다시 뜨지 않습니다. 기기별 저장이 아니라 DB 라서,
 *   노트북에서 확인하면 폰에서도 뜨지 않습니다.
 * - 안내 종류마다 키를 하나씩 씁니다. 새 안내가 생기면 아래에 키만 추가하면 됩니다.
 */

import { createClient } from '@/lib/supabase/client'

/** 가입 직후 시작 안내(미션·마켓·화분 사용법) */
export const PARENT_ONBOARDING_WELCOME_BASICS = 'welcome_basics_v1'

/** 승인 탭 상단 안내(칭찬 스티커·오늘 완료 미션·메뉴 제어) */
export const PARENT_ONBOARDING_APPROVAL_TAB = 'approval_tab_guide_v1'

/** 자녀 레벨업 축하 팝업 — 「다시 보지 않기」를 체크하면 이후 레벨업에도 뜨지 않습니다 */
export const PARENT_ONBOARDING_LEVEL_UP_POPUP = 'level_up_popup_v1'

/**
 * 이 안내를 확인했는지 **확실히 알 때만** true/false 를 돌려줍니다.
 * 알 수 없으면(미로그인·오류·마이그레이션 미적용) `null` 입니다.
 *
 * 왜 구분하나: 「모름」을 「확인함」으로 뭉뚱그리면, 일시적인 오류 한 번으로
 * 팝업이 영영 안 뜨게 만들 수 있습니다(되돌릴 방법도 없습니다).
 */
export async function readParentOnboardingAck(key: string): Promise<boolean | null> {
  if (typeof window === 'undefined') return null
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('parent_onboarding_acks')
      .select('onboarding_key')
      .eq('parent_id', user.id)
      .eq('onboarding_key', key)
      .maybeSingle()

    if (error) {
      console.warn('[parentOnboardingAck] 조회 실패(131 마이그레이션 필요?):', error.message)
      return null
    }
    return Boolean(data)
  } catch {
    return null
  }
}

/**
 * 이 안내를 이미 확인했는지 확인합니다.
 * 판단이 불가능하면 `true` 로 봅니다 — 팝업이 잘못 뜨는 쪽보다 안 뜨는 쪽이 안전한
 * 안내(가입 첫 팝업 등)에서만 쓰세요. 반대로 「모름 때문에 영영 안 뜨면 곤란한」
 * 경우에는 `readParentOnboardingAck` 로 `null` 을 직접 다루세요.
 */
export async function hasAcknowledgedParentOnboarding(key: string): Promise<boolean> {
  return (await readParentOnboardingAck(key)) ?? true
}

/** 이 안내를 확인한 것으로 기록합니다 */
export async function acknowledgeParentOnboarding(key: string): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('parent_onboarding_acks')
      .upsert(
        { parent_id: user.id, onboarding_key: key, acked_at: new Date().toISOString() },
        { onConflict: 'parent_id,onboarding_key' },
      )
    if (error) {
      console.warn('[parentOnboardingAck] 저장 실패(131 마이그레이션 필요?):', error.message)
    }
  } catch {
    /* 저장 실패 시 이번 화면만 닫힘 유지 */
  }
}
