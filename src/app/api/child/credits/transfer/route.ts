import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import { creditsFloating, readChildStatInt } from '@/lib/childCreditsSplit'
import { fireGameTrigger } from '@/lib/gameLayer/fireGameTrigger'

/**
 * POST /api/child/credits/transfer
 * body: { kind, amount, childId? }
 * - kind: 지갑·저금통·가용(섬) 사이 이동. 총 credits 는 변하지 않습니다.
 */
const KINDS = [
  'float_to_wallet',
  'float_to_piggy',
  'wallet_to_float',
  'piggy_to_float',
  'wallet_to_piggy',
  'piggy_to_wallet',
] as const

type Kind = (typeof KINDS)[number]

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  let kind: unknown
  let amountRaw: unknown
  let bodyChildId: unknown
  try {
    const body = await req.json()
    kind = body.kind
    amountRaw = body.amount
    bodyChildId = body.childId
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!KINDS.includes(kind as Kind)) {
    return NextResponse.json({ error: '옮기기 종류가 올바르지 않아요' }, { status: 400 })
  }

  const amount = typeof amountRaw === 'number' ? Math.floor(amountRaw) : Number.NaN
  if (!Number.isFinite(amount) || amount < 1) {
    return NextResponse.json({ error: '옮길 크레딧 수를 확인해 주세요' }, { status: 400 })
  }

  const resolved = await resolveApiActorChildId(supabase, user, bodyChildId)
  if (resolved.ok === false) return resolved.response
  const childId = resolved.childId

  const { data: stats, error: statsErr } = await supabase
    .from('child_stats')
    .select('credits, credits_wallet, credits_piggy')
    .eq('child_id', childId)
    .maybeSingle()

  if (statsErr?.code === '42703') {
    return NextResponse.json(
      { error: '앱 업데이트가 필요해요. 관리자에게 데이터베이스 마이그레이션을 적용해 달라고 요청해 주세요.' },
      { status: 503 },
    )
  }
  if (statsErr) {
    return NextResponse.json({ error: '스탯 정보를 읽지 못했어요' }, { status: 500 })
  }
  if (!stats) return NextResponse.json({ error: '스탯 정보를 찾을 수 없어요' }, { status: 404 })

  const w = readChildStatInt(stats.credits_wallet)
  const p = readChildStatInt(stats.credits_piggy)
  const row = { credits: readChildStatInt(stats.credits), credits_wallet: w, credits_piggy: p }
  const float = creditsFloating(row)

  let nw = w
  let np = p
  switch (kind as Kind) {
    case 'float_to_wallet':
      if (amount > float) return NextResponse.json({ error: '섬에 있는 크레딧이 부족해요' }, { status: 400 })
      nw = w + amount
      break
    case 'float_to_piggy':
      if (amount > float) return NextResponse.json({ error: '섬에 있는 크레딧이 부족해요' }, { status: 400 })
      np = p + amount
      break
    case 'wallet_to_float':
      if (amount > w) return NextResponse.json({ error: '지갑 크레딧이 부족해요' }, { status: 400 })
      nw = w - amount
      break
    case 'piggy_to_float':
      if (amount > p) return NextResponse.json({ error: '저금통 크레딧이 부족해요' }, { status: 400 })
      np = p - amount
      break
    case 'wallet_to_piggy':
      if (amount > w) return NextResponse.json({ error: '지갑 크레딧이 부족해요' }, { status: 400 })
      nw = w - amount
      np = p + amount
      break
    case 'piggy_to_wallet':
      if (amount > p) return NextResponse.json({ error: '저금통 크레딧이 부족해요' }, { status: 400 })
      np = p - amount
      nw = w + amount
      break
    default:
      return NextResponse.json({ error: '옮기기 종류가 올바르지 않아요' }, { status: 400 })
  }

  if (nw + np > stats.credits) {
    return NextResponse.json({ error: '크레딧 합계가 맞지 않아요' }, { status: 500 })
  }

  const { error } = await supabase
    .from('child_stats')
    .update({
      credits_wallet: nw,
      credits_piggy: np,
      updated_at: new Date().toISOString(),
    })
    .eq('child_id', childId)

  if (error) {
    return NextResponse.json({ error: '저장에 실패했어요' }, { status: 500 })
  }

  // ── 게임 트리거 ──
  let triggerResult = { fired: false, unlockedItemIndex: null as number | null }
  if (kind === 'float_to_piggy') {
    triggerResult = await fireGameTrigger(supabase, childId, 'FIRST_SAVE')
  } else if (kind === 'float_to_wallet') {
    triggerResult = await fireGameTrigger(supabase, childId, 'FIRST_WALLET_USE')
  }

  const totalC = row.credits
  return NextResponse.json({
    credits: totalC,
    credits_wallet: nw,
    credits_piggy: np,
    credits_floating: totalC - nw - np,
    itemUnlocked: triggerResult.fired && triggerResult.unlockedItemIndex !== null
      ? { index: triggerResult.unlockedItemIndex, triggerKey: kind === 'float_to_piggy' ? 'FIRST_SAVE' : 'FIRST_WALLET_USE' }
      : null,
  })
}
