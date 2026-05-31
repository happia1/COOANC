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

import { useEffect, useMemo, useState } from 'react'
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

/** 「네, 살게요」 이후 계산대 연출(슬롯 차감·동전)에 재생하는 효과음 */
const MARKET_CHECKOUT_SOUND_SRC =
  '/assets/audio/effects/floraphonic-coin-donation-6-183893.mp3' as const

function playMarketCheckoutSound() {
  try {
    const audio = new Audio(MARKET_CHECKOUT_SOUND_SRC)
    audio.volume = 0.85
    void audio.play().catch(() => {
      /* 브라우저 자동재생 정책 등으로 실패해도 조용히 무시 */
    })
  } catch {
    /* noop */
  }
}

export type MarketPurchaseSelected = {
  item: StoreItem
  frame: MarketItemFrameKey
}

type Props = {
  selected: MarketPurchaseSelected
  balanceBefore: number
  onClose: () => void
  onSubmit: (quantity: number) => Promise<boolean>
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

  useEffect(() => {
    setCheckoutStep('finalSure')
    setPayRunId(0)
    setDecoAnimate(false)
    setPurchaseQty(1)
  }, [item.id, balanceBefore])

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
    const t = window.setTimeout(() => setCheckoutStep('calcDone'), 420)
    return () => window.clearTimeout(t)
  }, [checkoutStep, slotDone])

  /** 「정말 구매」확인 — 여기서부터 슬롯·동전 애니메이션 */
  function startCheckoutAnimation() {
    playMarketCheckoutSound()
    setCheckoutStep('animating')
    setPayRunId(Date.now())
  }

  async function handleAcknowledgeAndSubmit() {
    if (requestBusy) return
    setRequestBusy(true)
    try {
      const ok = await onSubmit(clampedQty)
      if (ok) onSuccessDismiss()
    } finally {
      setRequestBusy(false)
    }
  }

  const showDeco = checkoutStep === 'animating' || checkoutStep === 'calcDone'
  const backdropClosable = checkoutStep === 'finalSure'
  /** 계산대 장식이 붙는 박스 — 단계마다 본문 높이가 달라져도 이 값으로 맞춰 장식 위치 고정 */
  const decoPhaseMinBodyHeight = 'min-h-[172px] sm:min-h-[186px]'

  const dialog = (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 px-4 py-10 sm:px-6 sm:py-12"
      role="dialog"
      aria-modal="true"
      aria-labelledby="market-purchase-title"
      onClick={(e) => {
        if (!backdropClosable) return
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
                    onClick={() => void handleAcknowledgeAndSubmit()}
                    className="w-full rounded-2xl bg-brand-blue py-3 text-sm font-black text-white shadow-md active:scale-[0.98] disabled:opacity-50"
                  >
                    {requestBusy ? '보내는 중…' : '확인'}
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
