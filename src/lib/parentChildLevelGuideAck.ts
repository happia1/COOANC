/**
 * 부모 홈 「자녀 레벨 안내」 블록의 닫기(X) 상태 — **DB 기준**입니다.
 *
 * 비개발자 설명:
 * - X 를 누르면 「그 자녀의 그 레벨 안내는 봤다」로 기록되어 홈에서 사라집니다.
 * - 자녀가 다음 레벨로 올라가면 새 안내가 다시 뜹니다.
 * - 닫아도 상단 알림창(공지센터)에서는 계속 볼 수 있습니다. 저장하는 건 「홈에 띄울지」뿐입니다.
 * - 기기별 저장소가 아니라 DB 라서, 노트북에서 닫으면 폰에서도 닫혀 있습니다.
 */

import { createClient } from '@/lib/supabase/client'

/** 자녀별로 「어느 레벨까지 확인했는지」 — 없으면 빈 Map */
export async function readDismissedLevelGuideLevels(): Promise<Map<string, number>> {
  if (typeof window === 'undefined') return new Map()
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return new Map()

    const { data, error } = await supabase
      .from('parent_child_level_guide_acks')
      .select('child_id, dismissed_level')
      .eq('parent_id', user.id)
    if (error || !data) return new Map()

    return new Map(
      (data as { child_id: string; dismissed_level: number | null }[]).map((r) => [
        r.child_id,
        Number(r.dismissed_level ?? 0),
      ]),
    )
  } catch {
    return new Map()
  }
}

/** 이 자녀의 현재 레벨 안내를 확인한 것으로 기록합니다 */
export async function writeDismissedLevelGuideLevel(childId: string, level: number): Promise<void> {
  if (typeof window === 'undefined' || !childId) return
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('parent_child_level_guide_acks').upsert(
      {
        parent_id: user.id,
        child_id: childId,
        dismissed_level: Math.max(0, Math.floor(level)),
        dismissed_at: new Date().toISOString(),
      },
      { onConflict: 'parent_id,child_id' },
    )
    if (error) {
      console.warn('[parentChildLevelGuideAck] 저장 실패(130 마이그레이션 필요?):', error.message)
    }
  } catch {
    /* 저장 실패 시 이번 화면만 닫힘 유지 */
  }
}
