import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import { readChildStatInt } from '@/lib/childCreditsSplit'
import { getSeoulDateString } from '@/lib/koreaDate'
import {
  generateClawLayout,
  type CheapSnackCandidate,
  type ClawSlot,
} from '@/lib/clawMachine'

/** 실물 간식 프라이즈 후보 — 활성 실물 상품 중 저가 N개 */
const CHEAP_SNACK_CANDIDATE_COUNT = 5

/**
 * POST /api/child/minigame/claw-session-start
 * - 보물상자 티켓 1장을 소모해 인형뽑기 세션을 새로 만듭니다.
 * - 이미 진행 중인(active·시도 남은) 세션이 있으면 재과금 없이 그대로 돌려줍니다.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })
    }

    let bodyChildId: unknown
    try {
      bodyChildId = (await req.json())?.childId
    } catch {
      bodyChildId = undefined
    }

    const resolved = await resolveApiActorChildId(supabase, user, bodyChildId)
    if (resolved.ok === false) return resolved.response
    const childId = resolved.childId

    const db = createServiceRoleClient() ?? supabase

    // 이미 진행 중인 세션이 있으면 재사용(재과금 없음)
    const { data: activeSession } = await db
      .from('minigame_sessions')
      .select('id, layout, tries_left')
      .eq('child_id', childId)
      .eq('status', 'active')
      .gt('tries_left', 0)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (activeSession) {
      const { data: ticketRow } = await db
        .from('content_tickets')
        .select('quantity')
        .eq('child_id', childId)
        .maybeSingle()
      return NextResponse.json({
        sessionId: activeSession.id,
        layout: activeSession.layout,
        triesLeft: readChildStatInt(activeSession.tries_left),
        chestTicketQuantity: readChildStatInt(ticketRow?.quantity),
      })
    }

    // 티켓 확인 + 낙관적 락으로 1장 차감
    const { data: ticketRow, error: ticketErr } = await db
      .from('content_tickets')
      .select('quantity')
      .eq('child_id', childId)
      .maybeSingle()
    if (ticketErr) {
      console.error('[claw-session-start] ticket select', ticketErr.message)
      return NextResponse.json({ error: '티켓 정보를 불러오지 못했어요' }, { status: 500 })
    }

    const qty = readChildStatInt(ticketRow?.quantity)
    if (qty < 1) {
      return NextResponse.json({ error: '보물상자 티켓이 없어요', code: 'NOT_ENOUGH_TICKETS' }, { status: 400 })
    }

    const { data: charged, error: chargeErr } = await db
      .from('content_tickets')
      .update({ quantity: qty - 1, updated_at: new Date().toISOString() })
      .eq('child_id', childId)
      .eq('quantity', qty)
      .select('quantity')
      .maybeSingle()

    if (chargeErr) {
      console.error('[claw-session-start] ticket charge', chargeErr.message)
      return NextResponse.json({ error: '티켓 차감에 실패했어요' }, { status: 500 })
    }
    if (!charged) {
      return NextResponse.json({ error: '다시 시도해 주세요', code: 'TICKET_RACE' }, { status: 409 })
    }

    // 실물 간식 후보(저가 순) — 레이아웃 생성 전 1회만 조회
    const { data: cheapItems } = await db
      .from('store_items')
      .select('id, name, image_url, credit_price')
      .eq('item_type', 'real')
      .eq('is_active', true)
      .order('credit_price', { ascending: true })
      .limit(CHEAP_SNACK_CANDIDATE_COUNT)

    const cheapSnacks: CheapSnackCandidate[] = (cheapItems ?? []).map((it) => ({
      id: it.id as string,
      name: it.name as string,
      imageUrl: (it.image_url as string | null) ?? null,
    }))

    const layout: ClawSlot[] = generateClawLayout(cheapSnacks)

    const { data: session, error: insertErr } = await db
      .from('minigame_sessions')
      .insert({
        child_id: childId,
        layout,
        tries_left: 5,
        status: 'active',
        day_key: getSeoulDateString(),
      })
      .select('id')
      .single()

    if (insertErr || !session) {
      console.error('[claw-session-start] insert', insertErr?.message)
      // 세션 생성 실패 — 이미 차감한 티켓을 되돌립니다.
      await db
        .from('content_tickets')
        .update({ quantity: qty, updated_at: new Date().toISOString() })
        .eq('child_id', childId)
        .eq('quantity', qty - 1)
      return NextResponse.json({ error: '게임을 시작하지 못했어요' }, { status: 500 })
    }

    return NextResponse.json({
      sessionId: session.id,
      layout,
      triesLeft: 5,
      chestTicketQuantity: qty - 1,
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    console.error('[claw-session-start] unexpected', e)
    return NextResponse.json({ error: '서버 오류가 발생했어요', detail }, { status: 500 })
  }
}
