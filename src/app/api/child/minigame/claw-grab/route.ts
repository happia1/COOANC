import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import { normalizeUuidParam } from '@/lib/normalizeUuid'
import { readChildStatInt } from '@/lib/childCreditsSplit'
import { findHitSlot, type ClawSlot } from '@/lib/clawMachine'

/**
 * POST /api/child/minigame/claw-grab
 * - 클로우 위치(0~100)로 뽑기 1회를 시도합니다. tries_left 를 1 소모합니다.
 * - 히트하면 슬롯의 상품을 지급하고 레이아웃에서 그 슬롯을 제거합니다.
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

    let body: { childId?: unknown; sessionId?: unknown; clawPosition?: unknown }
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const resolved = await resolveApiActorChildId(supabase, user, body.childId)
    if (resolved.ok === false) return resolved.response
    const childId = resolved.childId

    const sessionId = normalizeUuidParam(typeof body.sessionId === 'string' ? body.sessionId : null)
    if (!sessionId) {
      return NextResponse.json({ error: '세션 정보가 필요해요' }, { status: 400 })
    }
    const rawPosition = typeof body.clawPosition === 'number' ? body.clawPosition : NaN
    if (!Number.isFinite(rawPosition)) {
      return NextResponse.json({ error: '클로우 위치가 필요해요' }, { status: 400 })
    }
    const clawPosition = Math.max(0, Math.min(100, rawPosition))

    const db = createServiceRoleClient() ?? supabase

    const { data: session, error: sessionErr } = await db
      .from('minigame_sessions')
      .select('id, child_id, layout, tries_left, status')
      .eq('id', sessionId)
      .eq('child_id', childId)
      .maybeSingle()

    if (sessionErr) {
      console.error('[claw-grab] session select', sessionErr.message)
      return NextResponse.json({ error: '세션을 불러오지 못했어요' }, { status: 500 })
    }
    if (!session) {
      return NextResponse.json({ error: '세션을 찾을 수 없어요' }, { status: 404 })
    }
    const triesLeftBefore = readChildStatInt(session.tries_left)
    if (session.status !== 'active' || triesLeftBefore <= 0) {
      return NextResponse.json({ error: '이미 끝난 게임이에요', code: 'SESSION_OVER' }, { status: 400 })
    }

    const layout = (session.layout as ClawSlot[]) ?? []
    const hitSlot = findHitSlot(layout, clawPosition)
    const hit = hitSlot !== null

    const newTriesLeft = triesLeftBefore - 1
    const newLayout = hit ? layout.filter((s) => s.position !== hitSlot!.position) : layout
    const newStatus = newTriesLeft <= 0 ? 'completed' : 'active'

    const { data: claimed, error: claimErr } = await db
      .from('minigame_sessions')
      .update({ tries_left: newTriesLeft, layout: newLayout, status: newStatus })
      .eq('id', sessionId)
      .eq('status', 'active')
      .eq('tries_left', triesLeftBefore)
      .select('id')
      .maybeSingle()

    if (claimErr) {
      console.error('[claw-grab] claim try', claimErr.message)
      return NextResponse.json({ error: '뽑기에 실패했어요' }, { status: 500 })
    }
    if (!claimed) {
      return NextResponse.json({ error: '다시 시도해 주세요', code: 'GRAB_RACE' }, { status: 409 })
    }

    if (!hit) {
      return NextResponse.json({ hit: false, triesLeft: newTriesLeft, sessionStatus: newStatus })
    }

    const prize = hitSlot!.prize
    const statsPatch: Record<string, unknown> = {}
    let chestTicketQuantity: number | undefined

    if (prize.type === 'hearts') {
      const { data: row } = await db.from('child_stats').select('hearts').eq('child_id', childId).maybeSingle()
      const nextHearts = readChildStatInt(row?.hearts) + prize.amount
      await db.from('child_stats').update({ hearts: nextHearts }).eq('child_id', childId)
      statsPatch.hearts = nextHearts
    } else if (prize.type === 'credits') {
      const { data: row } = await db.from('child_stats').select('credits').eq('child_id', childId).maybeSingle()
      const nextCredits = readChildStatInt(row?.credits) + prize.amount
      await db.from('child_stats').update({ credits: nextCredits }).eq('child_id', childId)
      statsPatch.credits = nextCredits
    } else if (prize.type === 'seed') {
      const { error: seedErr } = await db.from('plant_seed_inventory').insert({
        child_id: childId,
        tree_id: prize.treeId,
        source: 'claw_machine',
      })
      if (seedErr) console.error('[claw-grab] seed grant', seedErr.message)
    } else if (prize.type === 'ticket') {
      const { data: row } = await db
        .from('content_tickets')
        .select('quantity')
        .eq('child_id', childId)
        .maybeSingle()
      const nextQty = readChildStatInt(row?.quantity) + prize.amount
      await db
        .from('content_tickets')
        .update({ quantity: nextQty, updated_at: new Date().toISOString() })
        .eq('child_id', childId)
      chestTicketQuantity = nextQty
    } else if (prize.type === 'snack') {
      const now = new Date().toISOString()
      const { error: snackErr } = await db.from('purchase_requests').insert({
        child_id: childId,
        item_id: prize.storeItemId,
        item_name: `인형뽑기 당첨 🎁 ${prize.storeItemName}`,
        item_price: 0,
        item_type: 'real',
        status: 'delivered',
        requested_at: now,
        approved_at: now,
        delivered_at: now,
      })
      if (snackErr) console.error('[claw-grab] snack grant', snackErr.message)
    }

    return NextResponse.json({
      hit: true,
      prize,
      wonPosition: hitSlot!.position,
      triesLeft: newTriesLeft,
      sessionStatus: newStatus,
      statsPatch: Object.keys(statsPatch).length > 0 ? statsPatch : undefined,
      chestTicketQuantity,
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    console.error('[claw-grab] unexpected', e)
    return NextResponse.json({ error: '서버 오류가 발생했어요', detail }, { status: 500 })
  }
}
