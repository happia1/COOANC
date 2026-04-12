'use client'

import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import SpriteImage from '@/components/common/SpriteImage'
import FloatingCreditsStackVisual from '@/components/child/FloatingCreditsStackVisual'
import PiggyBankStageVisual from '@/components/child/PiggyBankStageVisual'
import { MISSION_CREDITS_STAGE_CAP, piggyBankStageCount } from '@/constants/piggyBankStages'
import { ICONS } from '@/constants/sprites'
import { readChildStatInt } from '@/lib/childCreditsSplit'
import { walletImageSrcByStage, walletStageIndexByCredits } from '@/lib/walletStages'

/**
 * 미션 탭(저금통·돈바구니·지갑) 옮기기 UI 와 동일 규칙: 저금통 잔액(0~`MISSION_CREDITS_STAGE_CAP`)으로 단계 인덱스를 고릅니다.
 */
function piggyBankStepIndexForBalance(currentPiggy: number): number {
  const n = piggyBankStageCount()
  if (n <= 1) return 0
  const cap = MISSION_CREDITS_STAGE_CAP
  const clamped = Math.max(0, Math.min(currentPiggy, cap))
  return Math.round((clamped / cap) * (n - 1))
}

/** 지갑 그림은 `@/lib/walletStages` 와 미션 탭·마켓과 동일(9단계)입니다. */

export type CreditTransferKind =
  | 'float_to_wallet'
  | 'float_to_piggy'
  | 'wallet_to_float'
  | 'piggy_to_float'
  | 'wallet_to_piggy'
  | 'piggy_to_wallet'

/** `/api/child/credits/transfer` 성공 시 본문 — 화면을 Realtime 기다리지 않고 바로 맞출 때 사용 */
export type CreditTransferApiSuccess = {
  credits: number
  credits_wallet: number
  credits_piggy: number
}

function parseTransferSuccessJson(raw: unknown): CreditTransferApiSuccess | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!('credits' in o && 'credits_wallet' in o && 'credits_piggy' in o)) return null
  const credits = readChildStatInt(o.credits)
  const credits_wallet = readChildStatInt(o.credits_wallet)
  const credits_piggy = readChildStatInt(o.credits_piggy)
  return { credits, credits_wallet, credits_piggy }
}

type Props = {
  open: boolean
  onClose: () => void
  childId: string
  kind: CreditTransferKind | null
  maxAmount: number
  /** 팝업 상단 제목(이동 방향 설명) */
  title: string
  /** 서버가 돌려준 지갑·저금통·총액으로 부모 `stats` 를 즉시 갱신합니다(Realtime 지연과 무관). */
  onSuccess: (result: CreditTransferApiSuccess) => void
  /** 저금통 미리보기(`float_to_piggy` 등)에 쓸 현재 저금통 잔액 — `PiggyBankStageVisual` 단계와 동일 */
  piggyBalance: number
  /** 지갑 미리보기(`float_to_wallet` 등)에 쓸 현재 지갑 잔액 — 마켓과 같은 단계 그림 */
  walletBalance: number
}

/**
 * 크레딧을 지갑·저금통·돈바구니(가용) 사이로 옮길 때 뜨는 수량 입력 팝업입니다.
 * - 확인 시 `/api/child/credits/transfer` 를 호출합니다.
 */
export default function MissionCreditMoveDialog({
  open,
  onClose,
  childId,
  kind,
  maxAmount,
  title,
  onSuccess,
  piggyBalance,
  walletBalance,
}: Props) {
  /** 화면에 보이는 숫자(문자열). 빈 문자열이면 표시는 0, 아직 숫자 패드로만 채웁니다. */
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  /** `body`에 붙일 준비가 됐는지 — SSR·첫 페인트 직후에만 true (포털용) */
  const [portalReady, setPortalReady] = useState(false)

  useLayoutEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    if (open) {
      setAmount('')
      setErr(null)
      setBusy(false)
    }
  }, [open, maxAmount])

  /** 아래 숫자 패드에서 한 자리 누르면 이어 붙이고, 최댓값을 넘지 않게 자릅니다. */
  const appendDigit = useCallback(
    (digit: string) => {
      if (!/^\d$/.test(digit)) return
      setAmount((prev) => {
        const digitsOnly = prev.replace(/\D/g, '')
        const merged = digitsOnly + digit
        const next = parseInt(merged, 10)
        if (!Number.isFinite(next)) return prev
        return String(Math.min(maxAmount, next))
      })
    },
    [maxAmount],
  )

  /** 맨 끝 숫자 하나 지우기(잘못 입력했을 때 수정) */
  const backspace = useCallback(() => {
    setAmount((prev) => {
      const digitsOnly = prev.replace(/\D/g, '')
      if (digitsOnly.length <= 1) return ''
      return digitsOnly.slice(0, -1)
    })
  }, [])

  /** +1, +5, +10: 지금 숫자에 더합니다. 같은 버튼을 여러 번 눌러도 계속 더해집니다. */
  const addQuick = useCallback(
    (delta: number) => {
      setAmount((prev) => {
        const cur = Math.floor(parseInt(prev.replace(/\D/g, ''), 10) || 0)
        const next = cur + delta
        return String(Math.min(maxAmount, Math.max(0, next)))
      })
    },
    [maxAmount],
  )

  /** 전부: 옮길 수 있는 최대치로 맞춤 */
  const setAll = useCallback(() => {
    setAmount(String(Math.max(1, maxAmount)))
  }, [maxAmount])

  if (!open || !kind) return null

  /** 입력 문자열 → 정수(비어 있거나 잘못되면 0) */
  const parsed = Math.floor(parseInt(amount.replace(/\D/g, ''), 10) || 0)
  const n = parsed
  const valid = n >= 1 && n <= maxAmount

  async function submit() {
    if (!valid || busy) return
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch('/api/child/credits/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, amount: n, childId }),
      })
      const text = await res.text()
      let json: unknown = {}
      try {
        json = text ? JSON.parse(text) : {}
      } catch {
        setErr('응답을 읽지 못했어요')
        return
      }
      if (!res.ok) {
        const errObj = json && typeof json === 'object' ? (json as Record<string, unknown>) : {}
        setErr(typeof errObj.error === 'string' ? errObj.error : '옮기지 못했어요')
        return
      }
      const okPayload = parseTransferSuccessJson(json)
      if (!okPayload) {
        setErr('옮겼지만 숫자를 확인하지 못했어요. 잠시 뒤 다시 열어 주세요.')
        return
      }
      onSuccess(okPayload)
      onClose()
    } catch {
      setErr('네트워크 오류가 났어요')
    } finally {
      setBusy(false)
    }
  }

  /**
   * 아이 레이아웃의 `main`은 z-10, 독바는 z-50 이라 여기만 두면 키패드가 독바 «뒤»에 깔립니다.
   * `document.body`로 옮겨 항상 독바보다 위에 그리도록 합니다.
   */
  const modal = (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-2 pt-[max(0.25rem,env(safe-area-inset-top,0px))] pb-[max(0.25rem,env(safe-area-inset-bottom,0px))] sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="credit-move-title"
    >
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="닫기" onClick={onClose} />
      {/**
       * 한 화면에 맞추기: 세로 한도 + flex 열(스크롤 없음). 키패드·여백은 작은 화면에서 더 촘촘히 줄입니다.
       */}
      <div className="relative z-[1] flex max-h-[min(92dvh,calc(100dvh-0.75rem))] w-full max-w-sm flex-col overflow-hidden rounded-2xl border-2 border-sky-200 bg-white p-3 shadow-xl sm:max-h-[min(90dvh,34rem)] sm:p-3.5">
        <div className="min-h-0 shrink-0">
          <p id="credit-move-title" className="text-center text-base font-black leading-tight text-brand-text sm:text-[1.05rem]">
            {title}
          </p>

          {/**
           * 돈바구니(가용)에서 옮길 때: 크레딧 → 선택한 통(지갑/저금통) 그림을 화살표로 이어 방향을 확인합니다.
           * (긴 설명 문구는 빼서 작은 화면에서 키패드·빠른 버튼과 겹치지 않게 합니다.)
           */}
          {kind === 'float_to_wallet' || kind === 'float_to_piggy' ? (
            <div className="mt-2 flex items-center justify-center gap-1.5">
              <SpriteImage sheet={ICONS} frame="credit" width={28} clipRotated={false} className="opacity-95" />
              <span className="text-base font-black text-sky-400" aria-hidden>
                →
              </span>
              {kind === 'float_to_wallet' ? (
                <Image
                  src={walletImageSrcByStage(walletStageIndexByCredits(walletBalance))}
                  alt=""
                  width={44}
                  height={44}
                  className="h-auto w-9 select-none object-contain drop-shadow-md"
                  draggable={false}
                />
              ) : (
                <div className="flex min-h-[64px] min-w-[56px] shrink-0 items-end justify-center overflow-visible px-0.5 pb-0.5">
                  <PiggyBankStageVisual
                    stepIndex={piggyBankStepIndexForBalance(piggyBalance)}
                    displayWidth={44}
                    className="drop-shadow-md"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="mt-2 flex justify-center">
              <SpriteImage sheet={ICONS} frame="credit" width={30} clipRotated={false} className="opacity-90" />
            </div>
          )}

          <label className="mt-2 block text-center text-[10px] font-bold text-gray-500" htmlFor="credit-move-display">
            옮길 크레딧 (최대 {maxAmount.toLocaleString('ko-KR')})
          </label>
          {/*
            숫자만 보여 주는 영역: 시스템 키보드 대신 아래 패드로만 바꿉니다.
          */}
          <div
            id="credit-move-display"
            className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50/80 px-2 py-2 text-center text-xl font-black tabular-nums text-sky-900 sm:text-2xl sm:py-2.5"
            role="status"
            aria-live="polite"
            aria-label={`옮길 크레딧 ${amount === '' ? '입력 전' : parsed.toLocaleString('ko-KR')}`}
          >
            {amount === '' ? <span className="text-gray-400">0</span> : parsed.toLocaleString('ko-KR')}
          </div>

          {/*
            빠른 더하기: 1·5·10 은 «지금 값 + n». 전부는 최대 한도로 고정.
          */}
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {([1, 5, 10] as const).map((delta) =>
              maxAmount >= delta ? (
                <button
                  key={delta}
                  type="button"
                  onClick={() => addQuick(delta)}
                  className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-700 active:scale-[0.97]"
                >
                  {delta}
                </button>
              ) : null,
            )}
            {maxAmount >= 1 ? (
              <button
                type="button"
                onClick={setAll}
                className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-900 active:scale-[0.97]"
              >
                전부
              </button>
            ) : null}
          </div>
        </div>

        {/*
          숫자 키패드: 위 빠른 버튼(1·5·10·전부)과 겹치지 않도록 위쪽 여백을 넉넉히 둡니다.
        */}
        <div className="mt-3 flex min-h-0 flex-col gap-1 sm:mt-3.5" aria-label="숫자 입력">
          <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
            {(['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => appendDigit(d)}
                className="touch-manipulation rounded-md border border-gray-200 bg-white py-1.5 text-sm font-black tabular-nums text-sky-900 shadow-sm active:scale-[0.98] sm:py-2 sm:text-base"
              >
                {d}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={() => appendDigit('0')}
              className="touch-manipulation rounded-md border border-gray-200 bg-white py-1.5 text-sm font-black tabular-nums text-sky-900 shadow-sm active:scale-[0.98] sm:py-2 sm:text-base"
            >
              0
            </button>
            <button
              type="button"
              onClick={backspace}
              className="touch-manipulation rounded-md border border-gray-200 bg-gray-100 py-1.5 text-[11px] font-black text-gray-600 active:scale-[0.98] sm:py-2 sm:text-xs"
              aria-label="한 칸 지우기"
            >
              ⌫
            </button>
          </div>
        </div>

        <div className="mt-2 shrink-0 space-y-1">
          {err ? <p className="text-center text-[11px] font-bold leading-tight text-red-600">{err}</p> : null}
          <button
            type="button"
            disabled={!valid || busy}
            onClick={() => void submit()}
            className="w-full rounded-xl bg-brand-blue py-2.5 text-sm font-black text-white disabled:opacity-50 sm:py-3"
          >
            {busy ? '옮기는 중…' : '확인'}
          </button>
          <button type="button" onClick={onClose} className="w-full py-1.5 text-xs font-bold text-gray-500 sm:text-sm sm:py-2">
            취소
          </button>
        </div>
      </div>
    </div>
  )

  if (!portalReady) return null
  return createPortal(modal, document.body)
}

type SheetProps = {
  open: boolean
  onClose: () => void
  bucket: 'center' | 'wallet' | 'piggy'
  floating: number
  wallet: number
  piggy: number
  onPick: (kind: CreditTransferKind) => void
}

/**
 * 어느 통을 눌렀는지에 따라 「할 수 있는 옮기기」만 버튼으로 보여 줍니다.
 */
export function MissionCreditActionSheet({ open, onClose, bucket, floating, wallet, piggy, onPick }: SheetProps) {
  /** 다이얼로그와 같이 독바(z-50) 위에 보이려면 body 포털이 필요합니다. */
  const [portalReady, setPortalReady] = useState(false)
  useLayoutEffect(() => {
    setPortalReady(true)
  }, [])

  if (!open) return null

  type Row = { kind: CreditTransferKind; label: string }
  let rows: Row[] = []

  if (bucket === 'center') {
    if (floating > 0) {
      rows = [
        { kind: 'float_to_wallet', label: '지갑으로 옮기기 (마켓에서 쓸 돈)' },
        { kind: 'float_to_piggy', label: '저금통으로 옮기기 (모아 두기)' },
      ]
    }
  } else if (bucket === 'wallet') {
    rows = []
    if (wallet > 0) {
      rows.push({ kind: 'wallet_to_float', label: '돈바구니로 꺼내기 (다시 모아 두기)' })
      rows.push({ kind: 'wallet_to_piggy', label: '저금통으로 옮기기' })
    }
  } else {
    if (piggy > 0) {
      rows.push({ kind: 'piggy_to_float', label: '돈바구니로 꺼내기' })
      rows.push({ kind: 'piggy_to_wallet', label: '지갑으로 옮기기 (쓸 준비)' })
    }
  }

  /**
   * 모든 버킷(돈바구니/지갑/저금통)에서 이미지 카드로 선택하도록 통일합니다.
   * - 사용자가 텍스트를 읽지 않아도 아이콘만 보고 방향을 고를 수 있게 합니다.
   */
  function optionVisual(kind: CreditTransferKind): {
    title: string
    subtitle: string
    icon: 'wallet' | 'piggy' | 'credit'
    tone: 'amber' | 'sky'
  } {
    switch (kind) {
      case 'float_to_wallet':
      case 'piggy_to_wallet':
        return { title: '지갑으로', subtitle: '마켓에서 쓸 돈', icon: 'wallet', tone: 'amber' }
      case 'float_to_piggy':
      case 'wallet_to_piggy':
        return { title: '저금통으로', subtitle: '모아 두기', icon: 'piggy', tone: 'sky' }
      case 'wallet_to_float':
      case 'piggy_to_float':
        return { title: '꺼내기', subtitle: '다시 나눠 두기', icon: 'credit', tone: 'sky' }
      default:
        return { title: '선택', subtitle: '이동하기', icon: 'wallet', tone: 'amber' }
    }
  }

  const titleText = bucket === 'wallet' ? '지갑' : bucket === 'piggy' ? '저금통' : '돈바구니'
  const amountForBucket = bucket === 'center' ? floating : bucket === 'wallet' ? wallet : piggy
  const amountText = amountForBucket.toLocaleString('ko-KR')
  const showAmount = bucket === 'center' ? floating > 0 : true

  const sheet = (
    <div
      className="fixed inset-0 z-[115] flex items-center justify-center px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
      role="dialog"
      aria-modal="true"
    >
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="닫기" onClick={onClose} />
      <div className="relative z-[1] w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl">
        <p className="text-center text-sm font-black text-brand-text">{titleText}</p>
        {showAmount ? (
          <p className="mt-0.5 text-center text-base font-black tabular-nums text-sky-900 sm:text-lg">
            {amountText}
          </p>
        ) : null}
        <p className="mt-1 text-center text-[11px] text-gray-500">
          어디로 보낼지 골라보세요.
        </p>

        <div className="mt-3 flex flex-col gap-2">
          {rows.length === 0 ? (
            <p className="py-4 text-center text-xs text-gray-500">보낼 크레딧이 없어요</p>
          ) : (
            <div
              className="grid gap-2 pt-1"
              style={{ gridTemplateColumns: `repeat(${Math.min(rows.length, 3)}, minmax(0, 1fr))` }}
            >
              {rows.map((r) => {
                const visual = optionVisual(r.kind)
                const toneClass =
                  visual.tone === 'amber'
                    ? 'border-amber-200/90 bg-gradient-to-b from-amber-50/95 to-white'
                    : 'border-sky-200/90 bg-gradient-to-b from-sky-50/95 to-white'
                /** 아이콘 영역: 동일 높이 박스 안에서 가로·세로 중앙 — 크레딧 더미는 `centerInFrame` 으로 내부 스프라이트도 중앙 */
                const iconAreaClass =
                  'flex h-[104px] w-full shrink-0 items-center justify-center overflow-visible px-0.5'
                return (
                  <button
                    key={r.kind}
                    type="button"
                    onClick={() => {
                      onPick(r.kind)
                      onClose()
                    }}
                    className={`flex flex-col items-stretch gap-1.5 rounded-xl border-2 px-1.5 py-2.5 shadow-sm transition-transform active:scale-[0.98] ${toneClass}`}
                  >
                    {visual.icon === 'wallet' ? (
                      <div className={iconAreaClass}>
                        <Image
                          src={walletImageSrcByStage(walletStageIndexByCredits(wallet))}
                          alt=""
                          width={56}
                          height={56}
                          className="h-auto w-[52px] select-none object-contain drop-shadow-lg"
                          draggable={false}
                        />
                      </div>
                    ) : visual.icon === 'piggy' ? (
                      <div className={iconAreaClass}>
                        <PiggyBankStageVisual
                          stepIndex={piggyBankStepIndexForBalance(piggy)}
                          displayWidth={52}
                          className="drop-shadow-[0_6px_14px_rgba(0,0,0,0.15)]"
                        />
                      </div>
                    ) : (
                      <div className={iconAreaClass}>
                        <FloatingCreditsStackVisual
                          floating={floating}
                          dimWhenEmpty={false}
                          /** 옵션 카드에서도 돼지저금통(52px)과 같은 기준 크기로 맞춤 */
                          displayWidth={52}
                          centerInFrame
                        />
                      </div>
                    )}
                    <span className="text-center text-[11px] font-black leading-tight text-brand-text">{visual.title}</span>
                    <span className="text-center text-[9px] font-medium leading-snug text-gray-500">{visual.subtitle}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <button type="button" onClick={onClose} className="mt-3 w-full py-2 text-sm font-bold text-gray-500">
          닫기
        </button>
      </div>
    </div>
  )

  if (!portalReady) return null
  return createPortal(sheet, document.body)
}
