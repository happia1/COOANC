import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import { applyChildCreditsCas } from '@/lib/childStatsCreditsCas'
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

  const fromBucket: 'basket' | 'piggy' = kind === 'credits_to_piggy' ? 'basket' : 'piggy'
  const toBucket: 'basket' | 'piggy' = kind === 'credits_to_piggy' ? 'piggy' : 'basket'

  /**
   * 옮기기는 CAS 로 처리합니다.
   * 예전에는 읽은 잔액으로 credits·credits_piggy 를 통째로 덮어써서, 그사이 미션 보상이나
   * 결제가 저장되면 그 결과가 지워지고 화면 숫자가 튀었습니다(저금통에서 크레딧이 왔다갔다).
   */
  /**
   * 실제로 옮긴 수량 — **서버가 정합니다.**
   *
   * 왜 서버가 정하나: 예전에는 화면이 「가진 만큼만」 잘라서 보냈는데,
   * 화면의 낙관적 잔액이 서버와 어긋나 있으면 50을 눌러도 10만 옮겨졌습니다.
   * 이제 화면은 누른 수량을 그대로 보내고, 서버가 잔액을 보고 가능한 만큼 옮깁니다.
   */
  let movedAmount = 0

  const applied = await applyChildCreditsCas(supabase, childId, (current) => {
    const room = kind === 'credits_to_piggy' ? current.credits : current.piggy
    /** 잔액보다 많이 눌렀으면 실패시키지 않고 잔액만큼만 옮깁니다 */
    const move = Math.min(amount, room)

    if (move < 1) {
      return {
        ok: false as const,
        message: kind === 'credits_to_piggy' ? '크레딧이 부족해요' : '저금통에 크레딧이 부족해요',
      }
    }

    movedAmount = move
    return kind === 'credits_to_piggy'
      ? { ok: true as const, credits: current.credits - move, piggy: current.piggy + move }
      : { ok: true as const, credits: current.credits + move, piggy: current.piggy - move }
  })

  if (applied.ok === false) {
    if (applied.reason === 'rejected') {
      return NextResponse.json(
        {
          error: applied.message,
          credits: applied.current.credits,
          credits_piggy: applied.current.piggy,
        },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: '저장에 실패했어요' }, { status: 500 })
  }

  const nextCredits = applied.credits
  const nextPiggy = applied.piggy

  void supabase
    .from('credit_transfer_logs')
    .insert({
      child_id: childId,
      from_bucket: fromBucket,
      to_bucket: toBucket,
      amount: movedAmount,
    })
    .then(({ error: logErr }) => {
      if (logErr) console.error('[credit_transfer_logs]', logErr.message)
    })

  const triggerResult =
    kind === 'credits_to_piggy'
      ? await fireGameTrigger(supabase, childId, 'FIRST_SAVE')
      : { fired: false, unlockedItemIndex: null }

  /**
   * 저금통 이자 기간을 서버에서 갱신합니다.
   * - 10크레딧 이상이 되면 기간 시작, 10 미만으로 내려가면 리셋
   * - 3일이 지났으면 이자를 「받을 보너스」(piggy_bonus_pending)에 쌓습니다.
   *   저금통 잔액은 건드리지 않습니다 — 자녀가 코인을 눌러서 받아 가야 크레딧이 됩니다.
   * 실패해도(마이그레이션 미적용 등) 옮기기 자체는 이미 저장되었으므로 무시합니다.
   */
  let bonusPaid = 0
  let bonusPending = 0
  const { data: settled, error: settleErr } = await supabase.rpc('settle_piggy_bonus', {
    p_child_id: childId,
  })
  if (settleErr) {
    console.warn('[credits/transfer] 저금통 이자 정산 실패(128 마이그레이션 필요?):', settleErr.message)
  } else if (settled && typeof settled === 'object') {
    const s = settled as { paid?: number; pending?: number }
    bonusPaid = Number(s.paid ?? 0)
    bonusPending = Number(s.pending ?? 0)
  }

  return NextResponse.json({
    credits: nextCredits,
    credits_piggy: nextPiggy,
    /** 실제로 옮겨진 수량 — 누른 수량보다 적을 수 있습니다(잔액 한도) */
    moved: movedAmount,
    /** 이번 옮기기 직후 새로 붙은 이자(0이면 없음) */
    piggy_bonus_paid: bonusPaid,
    /** 아직 받아 가지 않고 쌓여 있는 이자 = 저금통 위에 뜰 코인 개수 */
    piggy_bonus_pending: bonusPending,
    itemUnlocked:
      triggerResult.fired && triggerResult.unlockedItemIndex !== null
        ? { index: triggerResult.unlockedItemIndex, triggerKey: 'FIRST_SAVE' }
        : null,
  })
}
