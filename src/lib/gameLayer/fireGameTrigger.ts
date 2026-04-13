import type { SupabaseClient } from '@supabase/supabase-js'
import { TRIGGER_TO_ITEM, type TriggerKey } from './triggerItemMap'

export interface FireGameTriggerResult {
  fired: boolean
  unlockedItemIndex: number | null
}

/**
 * 게임 트리거를 발동합니다. 첫 발동 시에만 아이템을 잠금 해제하고 true를 반환합니다.
 *
 * ON CONFLICT DO NOTHING 패턴으로 중복 발동을 원자적으로 방지합니다.
 * 서버사이드(API 라우트)에서만 호출하세요.
 */
export async function fireGameTrigger(
  supabase: SupabaseClient,
  childId: string,
  key: TriggerKey,
): Promise<FireGameTriggerResult> {
  // 트리거 발동 이력 삽입 (중복 시 무시) — `select` 는 컬럼 문자열만 받도록 타입이 좁혀져 count 옵션은 쓰지 않습니다
  const { error: insertErr, data: insertedRows } = await supabase
    .from('child_trigger_fired')
    .insert({ child_id: childId, trigger_key: key })
    .select('child_id')

  if (insertErr) {
    // ON CONFLICT(23505) = 이미 발동됨 → 조용히 무시
    if (insertErr.code === '23505') {
      return { fired: false, unlockedItemIndex: null }
    }
    // 다른 에러는 무시하고 계속 진행 (트리거 실패가 메인 플로우를 막으면 안 됨)
    console.error('[fireGameTrigger] insert error', insertErr)
    return { fired: false, unlockedItemIndex: null }
  }

  /** `ON CONFLICT DO NOTHING` 이면 삽입된 행이 없어 배열이 비어 있을 수 있음 */
  if (!insertedRows?.length) {
    return { fired: false, unlockedItemIndex: null }
  }

  const itemIndex = TRIGGER_TO_ITEM[key]
  if (itemIndex === null) {
    return { fired: true, unlockedItemIndex: null }
  }

  // 아이템 잠금 해제
  const { error: unlockErr } = await supabase.from('child_item_unlocks').insert({
    child_id:    childId,
    item_index:  itemIndex,
    trigger_key: key,
  })

  if (unlockErr && unlockErr.code !== '23505') {
    console.error('[fireGameTrigger] unlock error', unlockErr)
  }

  return { fired: true, unlockedItemIndex: itemIndex }
}
