import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import { readChildStatInt } from '@/lib/childCreditsSplit'
import { isCategoryExcludedFromMarket } from '@/lib/parentMarketMenuSections'
import { fireGameTrigger } from '@/lib/gameLayer/fireGameTrigger'
import { isQuantityPurchasableMarketItem } from '@/lib/contentTickets'

/** 잔액 경합으로 재시도하는 최대 횟수 */
const CREDIT_CAS_MAX_ATTEMPTS = 5

type DeductResult =
  | { ok: true; credits: number }
  | { ok: false; reason: 'insufficient'; available: number }
  | { ok: false; reason: 'error' }

/**
 * 크레딧 차감 — 낙관적 동시성 제어(CAS)
 *
 * 비개발자 설명:
 *   예전에는 "읽은 잔액 − 가격"을 계산해 그 값으로 **통째로 덮어썼습니다**. 그래서 크레딧을 읽은
 *   직후에 미션 보상이 들어오면, 그 보상이 반영된 잔액을 옛날 계산값으로 지워 버렸습니다.
 *   (예: 화면 201, 서버가 읽은 값 150 → 150−150=0 을 저장 → 51 크레딧이 사라짐)
 *
 *   이제는 "내가 읽은 그 값일 때만 바꾼다"(`.eq('credits', 읽은값)`)는 조건을 걸어 업데이트합니다.
 *   그사이 잔액이 바뀌었으면 아무 행도 안 바뀌므로, 최신 잔액을 다시 읽어 재시도합니다.
 *   → 동시에 들어온 미션 보상을 절대 덮어쓰지 않습니다.
 */
async function deductCreditsWithCas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  childId: string,
  price: number,
  firstReadCredits: unknown,
): Promise<DeductResult> {
  let observed = readChildStatInt(firstReadCredits)

  for (let attempt = 0; attempt < CREDIT_CAS_MAX_ATTEMPTS; attempt += 1) {
    if (observed < price) {
      return { ok: false, reason: 'insufficient', available: observed }
    }

    const next = observed - price
    const { data, error } = await supabase
      .from('child_stats')
      .update({
        credits: next,
        credits_wallet: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('child_id', childId)
      /** 핵심: 읽은 잔액이 그대로일 때만 차감 — 그사이 늘어난 보상을 지우지 않음 */
      .eq('credits', observed)
      .select('credits')

    if (error) {
      console.error('[market/request] credit deduct', error.message)
      return { ok: false, reason: 'error' }
    }
    if (data && data.length > 0) {
      return { ok: true, credits: next }
    }

    /** 경합 발생 — 최신 잔액을 다시 읽어 재시도 */
    const { data: fresh, error: freshErr } = await supabase
      .from('child_stats')
      .select('credits')
      .eq('child_id', childId)
      .maybeSingle()
    if (freshErr || !fresh) {
      return { ok: false, reason: 'error' }
    }
    observed = readChildStatInt(fresh.credits)
  }

  return { ok: false, reason: 'error' }
}

/**
 * 차감 되돌리기(환불) — 차감과 같은 이유로 절대값 복원 대신 "현재 잔액 + 가격"으로 되돌립니다.
 * 실패해도 구매 요청 생성 실패 응답은 그대로 나갑니다(로그만 남김).
 */
async function refundCreditsWithCas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  childId: string,
  price: number,
  knownCredits: number,
): Promise<void> {
  let observed = knownCredits

  for (let attempt = 0; attempt < CREDIT_CAS_MAX_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabase
      .from('child_stats')
      .update({ credits: observed + price, credits_wallet: 0, updated_at: new Date().toISOString() })
      .eq('child_id', childId)
      .eq('credits', observed)
      .select('credits')

    if (error) {
      console.error('[market/request] credit refund', error.message)
      return
    }
    if (data && data.length > 0) return

    const { data: fresh, error: freshErr } = await supabase
      .from('child_stats')
      .select('credits')
      .eq('child_id', childId)
      .maybeSingle()
    if (freshErr || !fresh) return
    observed = readChildStatInt(fresh.credits)
  }

  console.error('[market/request] credit refund gave up after retries', { childId, price })
}

/**
 * POST /api/market/request
 * body: { itemId, childMessage?, childId? }
 * - 자녀 본인: childId 생략 시 본인 계정으로 처리
 * - 부모가 자녀 마켓을 볼 때: childId 로 연결된 자녀만 차감·요청 생성
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: '인증이 필요해요' }, { status: 401 })

  let itemId: string
  let childMessage: string | null
  let bodyChildId: unknown
  let bodyQuantity: unknown
  try {
    const body = await req.json()
    itemId = body.itemId
    childMessage = body.childMessage ?? null
    bodyChildId = body.childId
    bodyQuantity = body.quantity
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  if (!itemId) {
    return NextResponse.json({ error: '상품 정보가 누락됐어요' }, { status: 400 })
  }

  const resolved = await resolveApiActorChildId(supabase, user, bodyChildId)
  if (resolved.ok === false) {
    return resolved.response
  }
  const childId = resolved.childId

  /**
   * 상품·스탯·가격 덮어쓰기를 한 번에 병렬 조회해 왕복 지연을 줄입니다.
   * (이전에는 순차 await 로 네트워크 왕복이 여러 번 이어졌음)
   */
  const [itemRes, statsRes, creditOvRes, existingPendingRes] = await Promise.all([
    supabase.from('store_items').select('*').eq('id', itemId).eq('is_active', true).maybeSingle(),
    supabase
      .from('child_stats')
      .select('credits, credits_wallet, credits_piggy, current_level')
      .eq('child_id', childId)
      .maybeSingle(),
    supabase
      .from('child_store_item_credit_overrides')
      .select('credit_price')
      .eq('child_id', childId)
      .eq('store_item_id', itemId)
      .maybeSingle(),
    supabase
      .from('purchase_requests')
      .select('id')
      .eq('child_id', childId)
      .eq('item_id', itemId)
      .eq('status', 'pending')
      .maybeSingle(),
  ])

  const item = itemRes.data
  if (!item) {
    return NextResponse.json({ error: '상품을 찾을 수 없어요' }, { status: 404 })
  }

  if (isCategoryExcludedFromMarket(item.category)) {
    return NextResponse.json({ error: '이 상품은 마켓에서 요청할 수 없어요' }, { status: 400 })
  }

  const purchaseQuantity = isQuantityPurchasableMarketItem(item.name, item.category)
    ? Math.min(99, Math.max(1, Math.floor(Number(bodyQuantity) || 1)))
    : 1

  /** 자녀별 덮어쓰기가 있으면 그 크레딧으로 결제합니다(없거나 테이블 미적용 시 기본가). */
  let unitPrice = item.credit_price
  const creditOverride = creditOvRes.data
  const creditOvErr = creditOvRes.error
  if (!creditOvErr && typeof creditOverride?.credit_price === 'number') {
    unitPrice = creditOverride.credit_price
  }

  const effectivePrice = unitPrice * purchaseQuantity

  const stats = statsRes.data
  if (!stats) {
    return NextResponse.json({ error: '스탯 정보를 찾을 수 없어요' }, { status: 404 })
  }

  if (stats.current_level < item.level_required) {
    return NextResponse.json({ error: '레벨이 부족해요' }, { status: 400 })
  }

  const existing = existingPendingRes.data
  if (existing) {
    return NextResponse.json({ error: '이미 요청 중인 상품이에요' }, { status: 409 })
  }

  const piggy = readChildStatInt(stats.credits_piggy)

  /**
   * 마켓 결제는 레벨 블록 총 코인(`credits`)을 기준으로 통일합니다.
   * 비개발자: 화면에 보이는 총 크레딧만 충분하면 구매가 되며, 결제 후 그 숫자에서 차감됩니다.
   */
  const deduct = await deductCreditsWithCas(supabase, childId, effectivePrice, stats.credits)
  if (!deduct.ok) {
    if (deduct.reason === 'insufficient') {
      return NextResponse.json(
        {
          error: '코인이 부족해요. 미션을 더 완료해서 코인을 모아보세요!',
          code: 'insufficient_credits',
          available: deduct.available,
        },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: '크레딧 차감에 실패했어요' }, { status: 500 })
  }
  const nextCredits = deduct.credits

  // 차감이 끝난 뒤, 단일/3버킷 구분 없이 동일한 구매 요청(pending) 레코드를 남깁니다.
  const { data: request, error: insertErr } = await supabase
    .from('purchase_requests')
    .insert({
      child_id: childId,
      item_id: itemId,
      item_name: item.name,
      item_price: effectivePrice,
      item_type: item.item_type,
      quantity: purchaseQuantity,
      status: 'pending',
      child_message: childMessage,
      requested_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (insertErr) {
    /** 차감분만 되돌립니다(옛 절대값 복원은 그사이 들어온 보상을 지웠으므로 사용하지 않음) */
    await refundCreditsWithCas(supabase, childId, effectivePrice, nextCredits)
    return NextResponse.json({ error: '요청 생성에 실패했어요. 다시 시도해 주세요.' }, { status: 500 })
  }

  // ── 게임 트리거: 첫 구매 요청 ──
  const triggerResult = await fireGameTrigger(supabase, childId, 'FIRST_PURCHASE')

  return NextResponse.json({
    request,
    credits: nextCredits,
    credits_wallet: 0,
    credits_piggy: piggy,
    itemUnlocked: triggerResult.fired && triggerResult.unlockedItemIndex !== null
      ? { index: triggerResult.unlockedItemIndex, triggerKey: 'FIRST_PURCHASE' }
      : null,
  }, { status: 201 })
}
