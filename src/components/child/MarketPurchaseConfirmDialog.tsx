'use client'

/**
 * 마켓 「구매 요청」확인 팝업 — 마트놀이(계산대) 연출
 *
 * 1) 상품 선택 직후 → 「정말 구매하시겠어요?」로 바로 진입
 * 2) 「네, 살게요」에서 계산기·손 슬라이드 등장 + 슬롯 차감 + 동전 낙하
 * 3) 「남은 크레딧」 확인 → API 요청 후 닫힘(`child_message` 는 부모 구매 요청 카드에 표시)
 *
 * 하단 버튼 유무로 영수증 영역 높이가 줄어들면 `absolute bottom` 장식이 위로 밀려 보이므로,
 * 장식이 보이는 구간은 본문·푸터에 고정 최소 높이를 둡니다.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { StoreItem } from '@/types/database'
import SpriteImage from '@/components/common/SpriteImage'
import { SHOP_ANIMATIONS, ICONS } from '@/constants/sprites'
import type { MarketItemFrameKey } from '@/lib/marketItemFrame'
import { isQuantityPurchasableMarketItem } from '@/lib/contentTickets'
import {
  formatVideoPassPurchaseDuration,
  isVideoViewingPassStoreItem,
} from '@/lib/contentWatchTime'
import { CHILD_AUDIO, playAudioWithTimedFadeOut } from '@/lib/childAudio'

export type MarketPurchaseSelected = {
  item: StoreItem
  frame: MarketItemFrameKey
}

type Props = {
  selected: MarketPurchaseSelected
  balanceBefore: number
  onClose: () => void
  onSubmit: (quantity: number) => Promise<{ ok: boolean; error?: string }>
  /** API 성공 직후 호출 — 팝업 전체 닫기 */
  onSuccessDismiss: () => void
}

/** MVP: 바로 finalSure(정말 구매?) → animating~calcDone: 계산대 연출 */
type CheckoutStep = 'finalSure' | 'animating' | 'calcDone'

function DigitSlot({ digit, tone }: { digit: number; tone: 'blue' | 'green' }) {
  const d = ((digit % 10) + 10) % 10
  const digitHeightEm = 1.2
  const colorCls = tone === 'green' ? 'text-green-600' : 'text-brand-blue'
  return (
    <span
      className="relative inline-block overflow-hidden align-baseline tabular-nums"
      style={{ width: '0.72em', height: `${digitHeightEm}em` }}
      aria-hidden
    >
      <span
        className="absolute left-0 top-0 flex flex-col transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{ transform: `translateY(-${d * digitHeightEm}em)` }}
      >
        {Array.from({ length: 10 }, (_, n) => (
          <span
            key={n}
            className={`flex shrink-0 items-center justify-center font-black leading-none ${colorCls}`}
            style={{ height: `${digitHeightEm}em`, fontSize: 'inherit' }}
          >
            {n}
          </span>
        ))}
      </span>
    </span>
  )
}

function SlotIntegerPlain({
  value,
  minDigits,
  tone,
}: {
  value: number
  minDigits: number
  tone: 'blue' | 'green'
}) {
  const v = Math.max(0, Math.floor(value))
  const raw = v.toString().split('')
  const pad = Math.max(0, minDigits - raw.length)
  const digits = [...Array(pad).fill('0'), ...raw]
  return (
    <span className="inline-flex items-baseline gap-[0.06em]" style={{ fontSize: 'inherit' }}>
      {digits.map((ch, i) => (
        <DigitSlot key={i} digit={Number(ch)} tone={tone} />
      ))}
    </span>
  )
}

type SlotOpts = { tickMs: number; initialDelayMs: number }

function useSlotBalanceSteps(from: number, to: number, runId: number, opts: SlotOpts) {
  const [stepIndex, setStepIndex] = useState(0)
  const active = runId > 0

  const steps = useMemo(() => {
    const a = Math.max(0, Math.floor(from))
    const b = Math.max(0, Math.floor(to))
    if (a === b) return [a]
    const diff = Math.abs(a - b)
    const maxFrames = 22
    const frameCount = Math.min(maxFrames, Math.max(8, Math.ceil(diff / 15)))
    const out: number[] = []
    for (let i = 0; i <= frameCount; i++) {
      const t = i / frameCount
      const e = 1 - (1 - t) ** 3
      const n = Math.round(a + (b - a) * e)
      if (out.length === 0 || out[out.length - 1] !== n) out.push(n)
    }
    if (out[out.length - 1] !== b) out.push(b)
    return out
  }, [from, to])

  useEffect(() => {
    if (!active) {
      setStepIndex(0)
      return
    }
    setStepIndex(0)
    if (steps.length <= 1) return

    let cancelled = false
    let i = 0
    const tick = () => {
      if (cancelled) return
      i += 1
      setStepIndex((prev) => Math.min(prev + 1, steps.length - 1))
      if (i < steps.length - 1) {
        window.setTimeout(tick, opts.tickMs)
      }
    }
    const id = window.setTimeout(tick, opts.initialDelayMs)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [active, steps, runId, opts.tickMs, opts.initialDelayMs])

  const current = active ? (steps[Math.min(stepIndex, steps.length - 1)] ?? from) : from
  const done = active && stepIndex >= steps.length - 1
  return { current, done }
}

/** 요청사항: 남은 크레딧 숫자 다이얼 차감이 더 천천히 보이도록 속도를 낮춥니다. */
const SLOW_SLOT: SlotOpts = { tickMs: 240, initialDelayMs: 460 }

export default function MarketPurchaseConfirmDialog({
  selected,
  balanceBefore,
  onClose,
  onSubmit,
  onSuccessDismiss,
}: Props) {
  const { item } = selected
  const supportsQuantity = isQuantityPurchasableMarketItem(item.name, item.category)
  const unitPrice = item.credit_price
  const [purchaseQty, setPurchaseQty] = useState(1)
  const maxPurchaseQty = Math.max(1, Math.min(99, Math.floor(balanceBefore / unitPrice) || 1))
  const clampedQty = Math.min(Math.max(1, purchaseQty), maxPurchaseQty)
  const price = unitPrice * clampedQty
  const after = Math.max(0, balanceBefore - price)
  const digitLen = Math.max(balanceBefore.toString().length, after.toString().length, 2)

  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('finalSure')
  const [payRunId, setPayRunId] = useState(0)
  /** React Strict Mode 에서 입장 애니메이션이 두 번 도는 것을 줄이기 위해 다음 프레임에만 클래스 부여 */
  const [decoAnimate, setDecoAnimate] = useState(false)
  const [requestBusy, setRequestBusy] = useState(false)
  /** 결제 요청이 이미 나갔는지 — state 와 달리 즉시 반영돼 같은 프레임의 연타를 막습니다 */
  const submitLockRef = useRef(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const checkoutSoundStopRef = useRef<(() => void) | null>(null)
  const prevItemIdRef = useRef(item.id)

  useEffect(() => {
    return () => {
      checkoutSoundStopRef.current?.()
      checkoutSoundStopRef.current = null
    }
  }, [])

  useEffect(() => {
    if (prevItemIdRef.current === item.id) return
    prevItemIdRef.current = item.id
    setCheckoutStep('finalSure')
    setPayRunId(0)
    setDecoAnimate(false)
    setPurchaseQty(1)
  }, [item.id])

  const { current: slotBalance, done: slotDone } = useSlotBalanceSteps(
    balanceBefore,
    after,
    payRunId,
    SLOW_SLOT,
  )

  useEffect(() => {
    if (checkoutStep !== 'animating' && checkoutStep !== 'calcDone') {
      setDecoAnimate(false)
      return
    }
    let cancelled = false
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) setDecoAnimate(true)
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [checkoutStep, payRunId])

  useEffect(() => {
    if (checkoutStep !== 'animating') return
    if (!slotDone) return
    const t = window.setTimeout(() => {
      setCheckoutStep('calcDone')
    }, 420)
    return () => window.clearTimeout(t)
  }, [checkoutStep, slotDone])

  /**
   * 계산 연출 안전장치 — 어떤 이유로든 슬롯 애니메이션이 끝나지 않아도 6초 뒤에는 다음 단계로
   * 넘겨 「확인 / 닫기」 버튼이 반드시 나타나게 합니다. (버튼 없는 화면에 갇히지 않도록)
   */
  useEffect(() => {
    if (checkoutStep !== 'animating') return
    const t = window.setTimeout(() => setCheckoutStep('calcDone'), 6000)
    return () => window.clearTimeout(t)
  }, [checkoutStep, payRunId])

  /** 「정말 구매」확인 — 여기서부터 슬롯·동전 애니메이션 */
  function startCheckoutAnimation() {
    setSubmitError(null)
    checkoutSoundStopRef.current?.()
    checkoutSoundStopRef.current = playAudioWithTimedFadeOut(CHILD_AUDIO.marketCheckout, {
      playMs: 800,
      fadeMs: 500,
      volume: 0.85,
    })
    setCheckoutStep('animating')
    setPayRunId(Date.now())
  }

  async function handleAcknowledgeAndSubmit() {
    /**
     * 중복 결제 방지 — `requestBusy` 는 state 라서 값이 바뀌기까지 한 프레임이 걸립니다.
     * 아이가 「확인」을 빠르게 두 번 누르면 두 호출 모두 `requestBusy === false` 를 보고
     * 결제 요청이 2개 나갔습니다. 그러면 먼저 도착한 요청이 크레딧을 차감한 뒤, 두 번째
     * 요청이 남은 잔액(예: 11)을 보고 "코인이 부족해요" 를 돌려줘 정상 결제가 실패한 것처럼
     * 보였습니다. ref 는 즉시 반영되므로 같은 프레임의 두 번째 탭도 확실히 막힙니다.
     */
    if (submitLockRef.current || requestBusy) return
    submitLockRef.current = true
    setSubmitError(null)
    setRequestBusy(true)
    try {
      const result = await onSubmit(clampedQty)
      if (result.ok) {
        onSuccessDismiss()
      } else {
        /**
         * 계산대 화면(calcDone)은 이미 「결제 완료」처럼 잔액을 보여준 뒤라, 실패했을 때
         * 같은 버튼으로 재시도시키면(예전 동작) 같은 오류가 계속 반복되며 빠져나갈 수 없었습니다.
         * 실패로 확정되면 재시도 대신 확인 버튼이 곧바로 팝업을 닫고 메인 화면으로 돌아가게 합니다.
         */
        setSubmitError(result.error ?? '구매 요청에 실패했어요. 잠시 후 다시 시도해 주세요.')
      }
    } finally {
      submitLockRef.current = false
      setRequestBusy(false)
    }
  }

  const showDeco = checkoutStep === 'animating' || checkoutStep === 'calcDone'
  /** 계산대 장식이 붙는 박스 — 단계마다 본문 높이가 달라져도 이 값으로 맞춰 장식 위치 고정 */
  const decoPhaseMinBodyHeight = 'min-h-[172px] sm:min-h-[186px]'

  const dialog = (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 px-4 py-10 sm:px-6 sm:py-12"
      role="dialog"
      aria-modal="true"
      aria-labelledby="market-purchase-title"
      /**
       * 배경(어두운 부분)을 누르면 **어느 단계에서든** 닫힙니다.
       * 예전에는 계산 연출 중에 버튼도 배경도 막혀 있어 빠져나갈 방법이 없었습니다.
       * 결제는 「확인」을 누른 뒤에만 이뤄지므로 도중에 닫아도 크레딧은 차감되지 않습니다.
       */
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="relative my-auto w-full max-w-md overflow-visible"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`relative w-full overflow-visible pb-2 pt-4 ${
            showDeco ? decoPhaseMinBodyHeight : 'min-h-[146px] sm:min-h-[160px]'
          }`}
        >
          {showDeco && (
            <>
              {/*
                bottom-0 기준은 이 래퍼 박스 — min-h 로 높이를 고정해 calcDone 전환 시에도
                계산기·손이 위로 "뛰지" 않게 함 (이전에는 본문이 짧아지며 bottom 기준이 올라감)
              */}
              <div
                className={`pointer-events-none absolute bottom-0 left-0 z-[30] w-max ${
                  decoAnimate ? 'market-pop-left' : 'opacity-0'
                }`}
              >
                {/*
                  translate-x 음수가 클수록 화면 밖(왼쪽)으로 나감 — 비율을 줄여 카드 안쪽으로 당김
                */}
                <div className="-translate-x-[36%] translate-y-10 drop-shadow-xl sm:-translate-x-[40%] sm:translate-y-7">
                  <SpriteImage sheet={SHOP_ANIMATIONS} frame="calculating" width={220} clipRotated={false} />
                </div>
              </div>

              <div
                className={`pointer-events-none absolute right-0 top-3 z-[35] w-max sm:top-4 ${
                  decoAnimate ? 'market-checkout-hand' : 'opacity-0'
                }`}
              >
                <div className="relative translate-x-[48%] translate-y-3 sm:translate-x-[52%] sm:translate-y-4">
                  <SpriteImage sheet={SHOP_ANIMATIONS} frame="paying" width={220} clipRotated={false} />
                </div>
              </div>
            </>
          )}

          {/* 본문 카드 — 장식보다 아래 레이어(계산기·손이 본문 위로 올라옴) */}
          <div className="relative z-[10] mx-auto flex w-full max-w-[min(100%,19rem)] justify-center px-4 pt-2 sm:max-w-[20.5rem] sm:px-6">
            <div className="relative w-full overflow-visible rounded-3xl bg-white px-4 pb-6 pt-5 text-center shadow-2xl ring-1 ring-black/[0.06] sm:px-5">

              {checkoutStep === 'finalSure' && (
                <div className="py-6">
                  <p
                    id="market-purchase-title"
                    className="text-base font-black leading-snug text-brand-text sm:text-lg"
                  >
                    정말 구매하시겠어요?
                  </p>
                  <p className="mt-2 text-xs font-bold text-gray-500 sm:text-sm">결제 시 크레딧이 바로 차감돼요</p>
                  {supportsQuantity && (
                    <div className="mt-4 flex items-center justify-center gap-3">
                      <span className="text-xs font-bold text-gray-600">수량</span>
                      <button
                        type="button"
                        aria-label="수량 줄이기"
                        disabled={clampedQty <= 1}
                        onClick={() => setPurchaseQty((q) => Math.max(1, q - 1))}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-lg font-black text-gray-700 disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="min-w-[2rem] text-center text-xl font-black tabular-nums text-brand-text">
                        {clampedQty}
                      </span>
                      <button
                        type="button"
                        aria-label="수량 늘리기"
                        disabled={clampedQty >= maxPurchaseQty}
                        onClick={() => setPurchaseQty((q) => Math.min(maxPurchaseQty, q + 1))}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-lg font-black text-gray-700 disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  )}
                  {isVideoViewingPassStoreItem(item.name, item.category) ? (
                    <p className="mt-3 text-center text-xs font-bold text-indigo-600 sm:text-sm">
                      총 {formatVideoPassPurchaseDuration(clampedQty)} 시청 가능
                    </p>
                  ) : null}
                  <div className="mt-6 flex flex-col items-center justify-center rounded-2xl bg-red-50/90 py-5 ring-1 ring-red-100">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <SpriteImage sheet={ICONS} frame="credit" width={28} clipRotated={false} />
                      <span className="text-4xl font-black tabular-nums text-red-600 sm:text-5xl">
                        -{price.toLocaleString('ko-KR')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {checkoutStep === 'animating' && (
                <div className="relative flex min-h-[138px] flex-col items-center justify-center py-4">
                  <p className="mb-2 text-sm font-bold text-gray-500">남은 크레딧</p>
                  <div className="text-4xl font-black leading-none tabular-nums text-brand-blue sm:text-5xl">
                    <SlotIntegerPlain value={slotBalance} minDigits={digitLen} tone="blue" />
                  </div>
                </div>
              )}

              {checkoutStep === 'calcDone' && (
                <div className="flex min-h-[138px] flex-col items-center justify-center py-4">
                  <p className="mb-2 text-sm font-bold text-gray-500">남은 크레딧</p>
                  <div className="text-4xl font-black tabular-nums text-brand-blue sm:text-5xl">
                    <SlotIntegerPlain value={after} minDigits={digitLen} tone="blue" />
                  </div>
                </div>
              )}

              {/*
                버튼을 같은 카드 안으로 넣어 박스가 여러 겹으로 보이지 않게 정리합니다.
                단계별 높이 흔들림을 줄이기 위해 최소 높이는 유지합니다.
              */}
              {submitError ? (
                <p className="mb-2 px-1 text-center text-xs font-bold text-red-600">{submitError}</p>
              ) : null}
              <div className="-mt-1 flex min-h-[46px] items-center gap-2.5 px-1 pb-0 pt-0.5">
                {checkoutStep === 'finalSure' && (
                  <>
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 rounded-2xl border-2 border-sky-200/90 bg-white py-3 text-sm font-bold text-gray-600 shadow-sm active:scale-[0.98]"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={startCheckoutAnimation}
                      className="flex-1 rounded-2xl bg-amber-500 py-3 text-sm font-black text-white shadow-md active:scale-[0.98]"
                    >
                      네, 살게요
                    </button>
                  </>
                )}
                {checkoutStep === 'animating' && <div className="h-12 w-full shrink-0" aria-hidden />}
                {checkoutStep === 'calcDone' && (
                  <button
                    type="button"
                    disabled={requestBusy}
                    /** 오류가 뜬 뒤에는 재시도하지 않고 그대로 팝업을 닫습니다(같은 오류 반복 방지) */
                    onClick={() => (submitError ? onClose() : void handleAcknowledgeAndSubmit())}
                    className="w-full rounded-2xl bg-brand-blue py-3 text-sm font-black text-white shadow-md active:scale-[0.98] disabled:opacity-50"
                  >
                    {requestBusy ? '보내는 중…' : submitError ? '닫기' : '확인'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(dialog, document.body)
}
