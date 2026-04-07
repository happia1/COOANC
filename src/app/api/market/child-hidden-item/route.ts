import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import type { PostgrestError } from '@supabase/supabase-js'

/**
 * RPC 가 DB 에 아직 없을 때만 true — 함수 이름만 들어간 다른 오류(예: EXECUTE 권한 거부)는 제외합니다.
 * (이전에는 permission denied 메시지에 함수명이 포함돼 폴백으로 빠져 저장 실패가 났습니다.)
 */
function isRpcFunctionNotAvailable(err: PostgrestError | null): boolean {
  if (!err) return false
  if (err.code === '42883' || err.code === 'PGRST202') return true
  const m = (err.message ?? '').toLowerCase()
  if (m.includes('could not find the function')) return true
  if (m.includes('function') && m.includes('does not exist')) return true
  if (m.includes('schema cache') && m.includes('function')) return true
  return false
}

/**
 * Postgres/PostgREST 코드를 부모 화면에 보일 짧은 한글 안내로 바꿉니다.
 * 42P01: 테이블 미생성(029 미적용) — 038 RPC만 넣으면 이 오류가 자주 납니다.
 */
function describeChildHiddenDbError(code: string | undefined, fallbackMessage: string): string {
  if (code === '42P01') {
    return (
      '마켓 숨김용 테이블이 DB에 없어요. Supabase SQL Editor에서 이 저장소의 ' +
      'supabase/migrations/029_child_market_hidden_items.sql 을 실행한 뒤, 필요하면 037·038 도 적용해 주세요.'
    )
  }
  if (code === '42501') {
    return '마켓 설정 저장 권한이 없어요. 마이그레이션 037·038을 적용하거나 SUPABASE_SERVICE_ROLE_KEY를 서버 환경에 설정해 주세요.'
  }
  return fallbackMessage || '저장하지 못했어요'
}

/**
 * POST /api/market/child-hidden-item
 * 부모가 자녀 마켓에서 상품을 숨기거나 다시 보이게 합니다.
 * body: { childId: string, itemId: string, hidden: boolean }
 *
 * - 우선 `set_child_market_item_hidden` RPC(038)로 저장 — 로컬에 service_role 키가 없어도 동작.
 * - RPC 이 없으면 service_role 또는 RLS+테이블 GRANT(037) 경로로 INSERT/DELETE.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 설정할 수 있어요' }, { status: 403 })
  }

  let childId: string
  let itemId: string
  let hidden: boolean
  try {
    const body = await req.json()
    childId = body.childId
    itemId = body.itemId
    hidden = Boolean(body.hidden)
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!childId || !itemId) {
    return NextResponse.json({ error: '자녀와 상품 정보가 필요해요' }, { status: 400 })
  }

  const { data: link } = await supabase
    .from('family_links')
    .select('id')
    .eq('parent_id', user.id)
    .eq('child_id', childId)
    .maybeSingle()

  if (!link) {
    return NextResponse.json({ error: '연결된 자녀만 설정할 수 있어요' }, { status: 403 })
  }

  /**
   * 1) RPC 우선: SECURITY DEFINER 로 쓰기 — 테이블에 대한 authenticated GRANT(037)나
   *    SERVICE_ROLE_KEY 없이도 로컬에서 토글이 저장되게 합니다. (마이그레이션 038)
   * 2) RPC 가 아직 없으면 기존처럼 직접 INSERT/DELETE (service_role 또는 RLS+GRANT).
   */
  const { error: rpcError } = await supabase.rpc('set_child_market_item_hidden', {
    p_child_id: childId,
    p_store_item_id: itemId,
    p_hidden: hidden,
  })

  const rpcFallback = !!rpcError && isRpcFunctionNotAvailable(rpcError)

  if (!rpcError) {
    // RPC 성공 — 아래 성공 응답으로 진행
  } else if (!rpcFallback) {
    console.error('[child-hidden-item] rpc', rpcError.code, rpcError.message, rpcError.details, rpcError.hint)
    return NextResponse.json(
      {
        error: describeChildHiddenDbError(rpcError.code, rpcError.message || '저장하지 못했어요'),
        code: rpcError.code,
        details: rpcError.details ?? undefined,
        hint: rpcError.hint ?? undefined,
      },
      { status: 500 },
    )
  } else {
    const writer = createServiceRoleClient() ?? supabase

    if (hidden) {
      const { error } = await writer.from('child_market_hidden_items').insert({
        child_id: childId,
        store_item_id: itemId,
      })
      if (error && error.code !== '23505') {
        console.error('[child-hidden-item] insert', error.code, error.message, error.details)
        const msg = describeChildHiddenDbError(error.code, error.message || '저장하지 못했어요')
        return NextResponse.json(
          { error: msg, code: error.code, details: error.details ?? undefined, hint: error.hint ?? undefined },
          { status: 500 },
        )
      }
    } else {
      const { error } = await writer
        .from('child_market_hidden_items')
        .delete()
        .eq('child_id', childId)
        .eq('store_item_id', itemId)
      if (error) {
        console.error('[child-hidden-item] delete', error.code, error.message, error.details)
        const msg = describeChildHiddenDbError(error.code, error.message || '저장하지 못했어요')
        return NextResponse.json(
          { error: msg, code: error.code, details: error.details ?? undefined, hint: error.hint ?? undefined },
          { status: 500 },
        )
      }
    }
  }

  return NextResponse.json({ ok: true })
}
