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
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()

  if (profile?.role === 'parent') {
    const cid = normalizeUuidParam(typeof bodyChildId === 'string' ? bodyChildId : null)
    if (!cid) {
      return { ok: false as const, response: NextResponse.json({ error: '자녀 정보가 필요해요' }, { status: 400 }) }
    }
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
