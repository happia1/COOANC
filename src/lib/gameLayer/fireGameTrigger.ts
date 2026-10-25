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
  // 새 이력이 생긴 경우에만 지급하며, 이미 있는 이력은 DB 오류 없이 건너뜁니다.
  const { error: insertErr, data: insertedRows } = await supabase
    .from('child_trigger_fired')
    .upsert({ child_id: childId, trigger_key: key }, {
      onConflict: 'child_id,trigger_key',
      ignoreDuplicates: true,
    })
    .select('child_id')

  if (insertErr) {
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
