import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeUuidParam } from '@/lib/normalizeUuid'

export type ResolveApiActorChildIdResult =
  | { ok: true; childId: string }
  | { ok: false; response: NextResponse }

/**
 * API 라우트에서 「이 요청이 어느 자녀 행에 적용되는지」 판별합니다.
 * - 자녀 세션: 항상 본인 user.id (body 의 childId 는 무시해 위조를 막음)
 * - 부모 세션: body(또는 쿼리)의 childId 가 family_links 로 연결돼 있어야 함
 */
export async function resolveApiActorChildId(
  supabase: SupabaseClient,
  user: User,
  bodyChildId: unknown,
): Promise<ResolveApiActorChildIdResult> {
  const requested = normalizeUuidParam(typeof bodyChildId === 'string' ? bodyChildId : null)

  /**
   * 본인에게 하는 요청은 역할을 묻지 않아도 답이 정해져 있습니다 — 본인 행입니다.
   *
   * 왜 이렇게 하나(속도):
   *   자녀 앱의 대부분 요청이 여기에 해당하는데, 그때마다 `profiles.role` 을 읽느라
   *   서버가 한 번 더 왕복했습니다. 저금통 옮기기가 느렸던 이유 중 하나입니다.
   *
   * 왜 안전한가:
   *   - 남의 id 를 보내면 이 지름길을 타지 않고 아래 원래 검사로 갑니다.
   *   - 부모가 자기 id 를 보내면 본인 행을 가리키는데, 부모에게는 child_stats 행이
   *     없으므로 뒤 단계에서 그대로 실패합니다(권한이 새지 않습니다).
   *   - 행 접근은 어차피 DB 의 RLS 가 한 번 더 막습니다.
   */
  if (!requested || requested === user.id) {
    return { ok: true as const, childId: user.id }
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()

  if (profile?.role === 'parent') {
    const cid = requested
    const { data: link } = await supabase
      .from('family_links')
      .select('id')
      .eq('parent_id', user.id)
      .eq('child_id', cid)
      .maybeSingle()
    if (!link) {
      return { ok: false as const, response: NextResponse.json({ error: '권한이 없어요' }, { status: 403 }) }
    }
    return { ok: true as const, childId: cid }
  }

  return { ok: true as const, childId: user.id }
}
