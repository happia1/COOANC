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
 *
 * 속도에 대해(비개발자 설명):
 *   예전에는 한 번 옮길 때마다 서버가 여러 번 왕복했습니다.
 *   인증 → 역할 확인 → 레벨 조회 → 잔액 읽기 → 저장 → 게임 트리거 → 이자 정산.
 *   그래서 옮기기 한 번에 몇 초가 걸렸고 「계산 중」이 계속 떠 있었습니다.
 *   지금은 꼭 기다려야 하는 것만 남기고, 나머지는 응답을 보낸 뒤 뒤에서 처리합니다.
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

  /**
   * 실제로 옮긴 수량 — **서버가 정합니다.**
   *
   * 왜 서버가 정하나: 예전에는 화면이 「가진 만큼만」 잘라서 보냈는데,
   * 화면의 낙관적 잔액이 서버와 어긋나 있으면 50을 눌러도 10만 옮겨졌습니다.
   * 이제 화면은 누른 수량을 그대로 보내고, 서버가 잔액을 보고 가능한 만큼 옮깁니다.
   *
   * 레벨 확인도 여기서 함께 합니다 — 잔액을 읽을 때 레벨도 같이 읽어 오므로,
   * 레벨 때문에 서버가 한 번 더 왕복하지 않습니다.
   */
  let movedAmount = 0

  const applied = await applyChildCreditsCas(supabase, childId, (current) => {
    if (!isPiggyBankUnlocked(current.level)) {
      return { ok: false as const, message: '저금통은 레벨 5부터 사용할 수 있어요' }
    }

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
  const fromBucket: 'basket' | 'piggy' = kind === 'credits_to_piggy' ? 'basket' : 'piggy'
  const toBucket: 'basket' | 'piggy' = kind === 'credits_to_piggy' ? 'piggy' : 'basket'

  /** 옮김 기록 — 화면이 기다릴 이유가 없어 응답 뒤에 저장합니다 */
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

  /**
   * 저금통 이자 정산 — **기다리지 않습니다.**
   * 자녀 앱이 열릴 때도 같은 정산이 돌기 때문에 여기서 결과를 기다릴 이유가 없고,
   * 기다리면 옮기기 응답이 그만큼 늦어져 「계산 중」이 오래 떠 있었습니다.
   */
  void supabase.rpc('settle_piggy_bonus', { p_child_id: childId }).then(({ error }) => {
    if (error) console.warn('[credits/transfer] 저금통 이자 정산 실패:', error.message)
  })

  /**
   * 첫 저금 보상(게임 아이템 해금)만 기다립니다 — 응답에 실어 보내야 팝업이 뜹니다.
   * 꺼내기(piggy_to_credits)는 해당 없으므로 아예 호출하지 않습니다.
   */
  const triggerResult =
    kind === 'credits_to_piggy'
      ? await fireGameTrigger(supabase, childId, 'FIRST_SAVE')
      : { fired: false, unlockedItemIndex: null }

  return NextResponse.json({
    credits: nextCredits,
    credits_piggy: nextPiggy,
    /**
     * 이 저장이 언제 것인지 — 화면이 「이보다 오래된 Realtime 알림」을 무시하는 데 씁니다.
     * (미션 완료 시 DB 트리거가 옛 크레딧으로 한 번 더 저장하는데,
     *  그 알림이 늦게 도착해 화면 숫자를 과거로 되돌리던 문제를 막습니다.)
     */
    updated_at: applied.updatedAt,
    /** 실제로 옮겨진 수량 — 누른 수량보다 적을 수 있습니다(잔액 한도) */
    moved: movedAmount,
    itemUnlocked:
      triggerResult.fired && triggerResult.unlockedItemIndex !== null
        ? { index: triggerResult.unlockedItemIndex, triggerKey: 'FIRST_SAVE' }
        : null,
  })
}
