'use client'

/**
 * 마켓 「구매 요청」확인 팝업 — 마트놀이(계산대) 연출
 *
 * 1) 영수증(잔액·살 물건) + 하단 취소 | 구매하기
 * 2) 구매하기 → 「정말 구매하시겠어요?」+ 최종 차감(-N)만 강조, 확인 시에만 계산 연출 시작
 * 3) 계산기·손 슬라이드 등장 → 슬롯 차감 + 동전 낙하 → 「남은 크레딧」
 * 4) 확인 → API 요청 후 닫힘(`child_message` 는 부모 구매 요청 카드에 표시)
 *
 * 하단 버튼 유무로 영수증 영역 높이가 줄어들면 `absolute bottom` 장식이 위로 밀려 보이므로,
 * 장식이 보이는 구간은 본문·푸터에 고정 최소 높이를 둡니다.
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { StoreItem } from '@/types/database'
import SpriteImage from '@/components/common/SpriteImage'
import MarketItemImage from '@/components/common/MarketItemImage'
import { SHOP_ANIMATIONS, ICONS } from '@/constants/sprites'
import type { MarketItemFrameKey } from '@/lib/marketItemFrame'

export type MarketPurchaseSelected = {
  item: StoreItem
  frame: MarketItemFrameKey
}

type Props = {
  selected: MarketPurchaseSelected
  balanceBefore: number
  onClose: () => void
  onSubmit: () => Promise<boolean>
  /** API 성공 직후 호출 — 팝업 전체 닫기 */
  onSuccessDismiss: () => void
}

/** confirm: 영수증 → finalSure: 정말 구매?(-N) → animating~calcDone: 계산대 연출 */
type CheckoutStep = 'confirm' | 'finalSure' | 'animating' | 'calcDone'

function DigitSlot({ digit, tone }: { digit: number; tone: 'blue' | 'green' }) {
  const d = ((digit % 10) + 10) % 10
  const digitHeightEm = 1.2
  const colorCls = tone === 'green' ? 'text-green-600' : 'text-brand-blue'
  return (
    <span
      className="relative inline-block overflow-hidden align-baseline tabular-nums"
      style={{ width: '0.62em', height: `${digitHeightEm}em` }}
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
    <span className="inline-flex items-baseline gap-px" style={{ fontSize: 'inherit' }}>
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

const SLOW_SLOT: SlotOpts = { tickMs: 135, initialDelayMs: 320 }

export default function MarketPurchaseConfirmDialog({
  selected,
  balanceBefore,
  onClose,
  onSubmit,
  onSuccessDismiss,
}: Props) {
  const { item, frame } = selected
  const price = item.credit_price
  const after = Math.max(0, balanceBefore - price)
  const digitLen = Math.max(balanceBefore.toString().length, after.toString().length, 2)

  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('confirm')
  const [payRunId, setPayRunId] = useState(0)
  /** React Strict Mode 에서 입장 애니메이션이 두 번 도는 것을 줄이기 위해 다음 프레임에만 클래스 부여 */
  const [decoAnimate, setDecoAnimate] = useState(false)
  const [requestBusy, setRequestBusy] = useState(false)

  useEffect(() => {
    setCheckoutStep('confirm')
    setPayRunId(0)
    setDecoAnimate(false)
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

  /** 첫 「구매하기」— 아직 계산 연출은 시작하지 않고, 최종 확인 단계로만 이동 */
  function goToFinalSure() {
    setCheckoutStep('finalSure')
  }

  /** 「정말 구매」확인 — 여기서부터 슬롯·동전 애니메이션 */
  function startCheckoutAnimation() {
    setCheckoutStep('animating')
    setPayRunId(Date.now())
  }

  async function handleAcknowledgeAndSubmit() {
    if (requestBusy) return
    setRequestBusy(true)
    try {
      const ok = await onSubmit()
      if (ok) onSuccessDismiss()
    } finally {
      setRequestBusy(false)
    }
  }

  const showDeco = checkoutStep === 'animating' || checkoutStep === 'calcDone'
  const backdropClosable = checkoutStep === 'confirm' || checkoutStep === 'finalSure'
  /** 계산대 장식이 붙는 박스 — 단계마다 본문 높이가 달라져도 이 값으로 맞춰 장식 위치 고정 */
  const decoPhaseMinBodyHeight = 'min-h-[300px] sm:min-h-[320px]'

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="market-purchase-title"
      onClick={(e) => {
        if (!backdropClosable) return
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="relative w-full max-w-md overflow-visible rounded-3xl shadow-2xl"
        style={{ background: '#FFF8F0' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`relative w-full overflow-visible pb-2 pt-4 ${
            showDeco ? decoPhaseMinBodyHeight : 'min-h-[260px] sm:min-h-[280px]'
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

          {/* 영수증 — 장식보다 아래 레이어(계산기·손이 영수증 위로 올라옴), 본문은 좁은 열이라 숫자는 가리지 않음 */}
          <div className="relative z-[10] mx-auto flex w-full max-w-[min(100%,19rem)] justify-center px-4 pt-2 sm:max-w-[20.5rem] sm:px-6">
            <div
              className="market-receipt-sheet relative w-full overflow-visible rounded-xl px-4 pb-6 pt-4 text-center shadow-md sm:px-5"
              style={{
                background:
                  'repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 1px, transparent 1px, transparent 8px), linear-gradient(180deg, #ffffff 0%, #fbfaf8 100%)',
                boxShadow:
                  '0 6px 20px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.95), inset 0 0 0 1px rgba(0,0,0,0.05)',
                border: '1px dashed rgba(0,0,0,0.12)',
              }}
            >
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-200/90" aria-hidden />

              {checkoutStep === 'confirm' && (
                <>
                  <div className="mb-1.5 flex items-center justify-center gap-1.5">
                    <SpriteImage sheet={ICONS} frame="credits" width={18} clipRotated={false} />
                    <span className="text-[11px] font-bold tracking-tight text-gray-500 sm:text-xs">
                      지금 내 크레딧
                    </span>
                  </div>
                  <div className="text-2xl font-black leading-tight tabular-nums sm:text-3xl">
                    <span className="text-brand-blue">{balanceBefore.toLocaleString('ko-KR')}</span>
                  </div>
                  <div className="mt-4 flex gap-3 border-t border-dashed border-gray-200/90 pt-4 text-left">
                    <div className="flex h-[5.25rem] w-[5.25rem] shrink-0 items-end justify-center overflow-hidden rounded-xl bg-white/90 shadow-inner ring-1 ring-black/[0.06] sm:h-[5.75rem] sm:w-[5.75rem]">
                      {item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image_url}
                          alt=""
                          className="max-h-[4.75rem] max-w-full object-contain object-bottom sm:max-h-[5.25rem]"
                          draggable={false}
                        />
                      ) : (
                        <MarketItemImage frame={frame} height={84} />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">살 물건</p>
                      <p
                        id="market-purchase-title"
                        className="text-sm font-black leading-snug text-brand-text sm:text-[0.95rem]"
                      >
                        {item.name}
                      </p>
                      {item.description && (
                        <p className="line-clamp-2 text-[10px] leading-snug text-gray-400 sm:text-[11px]">
                          {item.description}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center justify-start gap-2">
                        <SpriteImage sheet={ICONS} frame="credit" width={22} clipRotated={false} />
                        <span className="text-2xl font-black leading-none tabular-nums text-red-600 sm:text-3xl">
                          -{price.toLocaleString('ko-KR')}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {checkoutStep === 'finalSure' && (
                <div className="py-6">
                  <p
                    id="market-purchase-title"
                    className="text-base font-black leading-snug text-brand-text sm:text-lg"
                  >
                    정말 구매하시겠어요?
                  </p>
                  <p className="mt-2 text-xs font-bold text-gray-500 sm:text-sm">결제 시 크레딧이 바로 차감돼요</p>
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
                <div className="relative flex min-h-[240px] flex-col items-center justify-center py-8">
                  <div className="pointer-events-none absolute left-1/2 top-0 z-[5] w-max -translate-x-1/2" aria-hidden>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span
                        key={`${payRunId}-c-${i}`}
                        className="market-credit-coin-drop-slow absolute left-1/2 top-0 -translate-x-1/2"
                        style={
                          {
                            animationDelay: `${i * 420}ms`,
                            ['--coin-dx' as string]: `${-10 + i * 5}px`,
                          } as CSSProperties
                        }
                      >
                        <SpriteImage sheet={ICONS} frame="credit" width={34} clipRotated={false} />
                      </span>
                    ))}
                  </div>
                  <p className="mb-2 text-sm font-bold text-gray-500">남은 크레딧</p>
                  <div className="text-4xl font-black leading-none tabular-nums text-brand-blue sm:text-5xl">
                    <SlotIntegerPlain value={slotBalance} minDigits={digitLen} tone="blue" />
                  </div>
                </div>
              )}

              {checkoutStep === 'calcDone' && (
                <div className="flex min-h-[240px] flex-col items-center justify-center py-10">
                  <p className="mb-2 text-sm font-bold text-gray-500">남은 크레딧</p>
                  <div className="text-4xl font-black tabular-nums text-brand-blue sm:text-5xl">
                    <SlotIntegerPlain value={after} minDigits={digitLen} tone="blue" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/*
          animating 단계에서 버튼이 사라지면 카드 전체 높이가 줄어들어 배경이 덜컥이므로,
          푸터 슬롯 높이는 항상 동일하게 유지합니다.
        */}
        <div className="flex min-h-[60px] items-center gap-3 px-5 pb-6 pt-2">
          {checkoutStep === 'confirm' && (
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
                onClick={goToFinalSure}
                className="flex-1 rounded-2xl bg-amber-500 py-3 text-sm font-black text-white shadow-md active:scale-[0.98]"
              >
                구매하기
              </button>
            </>
          )}
          {checkoutStep === 'finalSure' && (
            <>
              <button
                type="button"
                onClick={() => setCheckoutStep('confirm')}
                className="flex-1 rounded-2xl border-2 border-sky-200/90 bg-white py-3 text-sm font-bold text-gray-600 shadow-sm active:scale-[0.98]"
              >
                돌아가기
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
  )
}
