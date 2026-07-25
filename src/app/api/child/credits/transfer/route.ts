import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import { readChildStatInt } from '@/lib/childCreditsSplit'
import { fireGameTrigger } from '@/lib/gameLayer/fireGameTrigger'
import { isPiggyBankUnlocked } from '@/constants/childAgeConfig'

/**
 * POST /api/child/credits/transfer
 * body: { kind, amount, childId? }
 *
 * - `credits_to_piggy`: 레벨 블록 가용 크레딧(`credits`) → 저금통(`credits_piggy`)으로 옮깁니다.
 * - `piggy_to_credits`: 저금통(`credits_piggy`) → 가용 크레딧(`credits`)으로 옮깁니다.
 */
const KINDS = ['credits_to_piggy', 'piggy_to_credits'] as const

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

  const statsRes = await supabase
    .from('child_stats')
    .select('credits, credits_piggy, current_level')
    .eq('child_id', childId)
    .maybeSingle()

  const stats = statsRes.data
  const statsErr = statsRes.error

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

  const level = stats.current_level ?? 0
  if (!isPiggyBankUnlocked(level)) {
    return NextResponse.json({ error: '저금통은 레벨 5부터 사용할 수 있어요' }, { status: 403 })
  }

  const available = readChildStatInt(stats.credits)
  const piggy = readChildStatInt(stats.credits_piggy)

  let nextCredits = available
  let nextPiggy = piggy
  let fromBucket: 'basket' | 'piggy'
  let toBucket: 'basket' | 'piggy'

  if (kind === 'credits_to_piggy') {
    if (amount > available) {
      return NextResponse.json({ error: '크레딧이 부족해요' }, { status: 400 })
    }
    nextCredits = available - amount
    nextPiggy = piggy + amount
    fromBucket = 'basket'
    toBucket = 'piggy'
  } else {
    if (amount > piggy) {
      return NextResponse.json({ error: '저금통에 크레딧이 부족해요' }, { status: 400 })
    }
    nextCredits = available + amount
    nextPiggy = piggy - amount
    fromBucket = 'piggy'
    toBucket = 'basket'
  }

  const { error } = await supabase
    .from('child_stats')
    .update({
      credits: nextCredits,
      credits_piggy: nextPiggy,
      credits_wallet: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('child_id', childId)

  if (error) {
    return NextResponse.json({ error: '저장에 실패했어요' }, { status: 500 })
  }

  void supabase
    .from('credit_transfer_logs')
    .insert({
      child_id: childId,
      from_bucket: fromBucket,
      to_bucket: toBucket,
      amount,
    })
    .then(({ error: logErr }) => {
      if (logErr) console.error('[credit_transfer_logs]', logErr.message)
    })

  const triggerResult =
    kind === 'credits_to_piggy'
      ? await fireGameTrigger(supabase, childId, 'FIRST_SAVE')
      : { fired: false, unlockedItemIndex: null }

  /**
   * 저금통 보너스 기간을 서버에서 갱신합니다.
   * - 10크레딧 이상이 되면 기간 시작, 10 미만으로 내려가면 리셋
   * - 7일이 지났으면 이 자리에서 바로 지급
   * 실패해도(마이그레이션 미적용 등) 옮기기 자체는 이미 저장되었으므로 무시합니다.
   */
  let bonusPaid = 0
  let piggyAfterBonus = nextPiggy
  const { data: settled, error: settleErr } = await supabase.rpc('settle_piggy_bonus', {
    p_child_id: childId,
  })
  if (settleErr) {
    console.warn('[credits/transfer] 저금통 보너스 정산 실패(127 마이그레이션 필요?):', settleErr.message)
  } else if (settled && typeof settled === 'object') {
    const s = settled as { paid?: number; credits_piggy?: number }
    bonusPaid = Number(s.paid ?? 0)
    piggyAfterBonus = Number(s.credits_piggy ?? nextPiggy)
  }

  return NextResponse.json({
    credits: nextCredits,
    credits_piggy: piggyAfterBonus,
    /** 이번 옮기기 직후 지급된 저금통 보너스(0이면 없음) */
    piggy_bonus_paid: bonusPaid,
    itemUnlocked:
      triggerResult.fired && triggerResult.unlockedItemIndex !== null
        ? { index: triggerResult.unlockedItemIndex, triggerKey: 'FIRST_SAVE' }
        : null,
  })
}
