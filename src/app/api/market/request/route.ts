import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveApiActorChildId } from '@/lib/resolveApiActorChildId'
import { readChildStatInt } from '@/lib/childCreditsSplit'
import { isCategoryExcludedFromMarket } from '@/lib/parentMarketMenuSections'
import { fireGameTrigger } from '@/lib/gameLayer/fireGameTrigger'

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
  try {
    const body = await req.json()
    itemId = body.itemId
    childMessage = body.childMessage ?? null
    bodyChildId = body.childId
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

  /** 자녀별 덮어쓰기가 있으면 그 크레딧으로 결제합니다(없거나 테이블 미적용 시 기본가). */
  let effectivePrice = item.credit_price
  const creditOverride = creditOvRes.data
  const creditOvErr = creditOvRes.error
  if (!creditOvErr && typeof creditOverride?.credit_price === 'number') {
    effectivePrice = creditOverride.credit_price
  }

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

  const piggy = typeof stats.credits_piggy === 'number' ? stats.credits_piggy : 0
  const wallet = readChildStatInt(stats.credits_wallet)
  const totalCredits = readChildStatInt(stats.credits)

  if (totalCredits < effectivePrice) {
    return NextResponse.json(
      { error: '코인이 부족해요. 미션을 더 완료해서 코인을 모아보세요!' },
      { status: 400 },
    )
  }

  /**
   * 마켓 결제는 레벨 블록 총 코인(`credits`)을 기준으로 통일합니다.
   * 비개발자: 화면에 보이는 총 크레딧만 충분하면 구매가 되며, 결제 후 그 숫자에서 차감됩니다.
   */
  const nextCredits = totalCredits - effectivePrice
  // 총액보다 지갑이 커지지 않도록 안전하게 맞춥니다.
  const nextWallet = Math.min(wallet, nextCredits)
  const { error: deductErr } = await supabase
    .from('child_stats')
    .update({
      credits: nextCredits,
      credits_wallet: nextWallet,
      credits_piggy: piggy,
      updated_at: new Date().toISOString(),
    })
    .eq('child_id', childId)
  if (deductErr) {
    return NextResponse.json({ error: '크레딧 차감에 실패했어요' }, { status: 500 })
  }

  // 차감이 끝난 뒤, 단일/3버킷 구분 없이 동일한 구매 요청(pending) 레코드를 남깁니다.
  const { data: request, error: insertErr } = await supabase
    .from('purchase_requests')
    .insert({
      child_id: childId,
      item_id: itemId,
      item_name: item.name,
      item_price: effectivePrice,
      item_type: item.item_type,
      status: 'pending',
      child_message: childMessage,
      requested_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (insertErr) {
    await supabase
      .from('child_stats')
      .update({
        credits: stats.credits,
        credits_wallet: wallet,
        credits_piggy: piggy,
      })
      .eq('child_id', childId)
    return NextResponse.json({ error: '요청 생성에 실패했어요. 다시 시도해 주세요.' }, { status: 500 })
  }

  // ── 게임 트리거: 첫 구매 요청 ──
  const triggerResult = await fireGameTrigger(supabase, childId, 'FIRST_PURCHASE')

  return NextResponse.json({
    request,
    credits: nextCredits,
    credits_wallet: nextWallet,
    credits_piggy: piggy,
    itemUnlocked: triggerResult.fired && triggerResult.unlockedItemIndex !== null
      ? { index: triggerResult.unlockedItemIndex, triggerKey: 'FIRST_PURCHASE' }
      : null,
  }, { status: 201 })
}
