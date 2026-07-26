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

/**
 * 이 안내를 이미 확인했는지 확인합니다.
 * 판단이 불가능하면(미로그인·오류·마이그레이션 미적용) `true` 를 돌려주어
 * 팝업이 잘못 뜨는 쪽보다 안 뜨는 쪽으로 안전하게 처리합니다.
 */
export async function hasAcknowledgedParentOnboarding(key: string): Promise<boolean> {
  if (typeof window === 'undefined') return true
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return true

    const { data, error } = await supabase
      .from('parent_onboarding_acks')
      .select('onboarding_key')
      .eq('parent_id', user.id)
      .eq('onboarding_key', key)
      .maybeSingle()

    if (error) {
      console.warn('[parentOnboardingAck] 조회 실패(131 마이그레이션 필요?):', error.message)
      return true
    }
    return Boolean(data)
  } catch {
    return true
  }
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
