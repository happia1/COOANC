'use client'

/**
 * 자녀 홈 발 옆 저금통 — 가용 크레딧과 저금통 사이를 1개씩 옮깁니다.
 *
 * 비개발자 설명:
 * - 레벨 5부터 토끼 발 옆에 저금통이 보입니다.
 * - 팝업에서 저금통을 누르면 왼쪽 크레딧 동전이 저금통으로, 크레딧을 누르면 저금통에서 왼쪽 동전으로 1개씩 날아갑니다.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { piggyBankVisualFrameIndexFromSavedCredits, piggyBankVisualUrlFromSavedCredits } from '@/lib/piggyBankHomeStage'
import { markPiggyBonusPeriodStarted } from '@/lib/piggyBankBonus'
import { PIGGY_BANK_UNLOCK_MIN_LEVEL } from '@/constants/childAgeConfig'
import { CHILD_CREDIT_COIN_PNG_SRC, formatChildCreditsDisplay } from '@/lib/childCreditDisplay'

export const CHILD_PIGGY_DEPOSIT_SOUND_SRC =
  `/assets/audio/effects/${encodeURIComponent('ElevenLabs_귀여운_동전_떨어지는_소리_효과.mp3')}` as const
export const CHILD_PIGGY_STAGE_UP_SOUND_SRC =
  '/assets/audio/effects/level_up-magic-festive-melody-2986.wav' as const

type TransferKind = 'credits_to_piggy' | 'piggy_to_credits'

function playDepositSound() {
  try {
    const audio = new Audio(CHILD_PIGGY_DEPOSIT_SOUND_SRC)
    audio.volume = 0.85
    void audio.play().catch(() => {})
  } catch {
    /* noop */
  }
}

function playPiggyStageUpSound() {
  try {
    const audio = new Audio(CHILD_PIGGY_STAGE_UP_SOUND_SRC)
    audio.volume = 0.92
    void audio.play().catch(() => {})
  } catch {
    /* noop */
  }
}

/** 저금통 입구(동전이 들어가는 지점) — 저금통 그림 기준 세로 % */
const PIGGY_SLOT_Y_RATIO = 0.42

function piggyTransferHintSeenKey(childId: string): string {
  return `cooanc:piggy-transfer-hint-seen:${childId}`
}

function hasSeenPiggyTransferHint(childId: string): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(piggyTransferHintSeenKey(childId)) === '1'
}

function markPiggyTransferHintSeen(childId: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(piggyTransferHintSeenKey(childId), '1')
}

type FlyCoin = {
  id: number
  fromX: number
  fromY: number
  toX: number
  toY: number
}

type Props = {
  /** 레벨 블록과 같은 `child_stats.credits`(가용) */
  availableCredits: number
  piggyCredits: number
  childId: string
  depositEnabled: boolean
  /** @deprecated 팝업 내 좌·우 패널 좌표를 씁니다. 호출부 호환용 */
  levelCreditRef?: React.RefObject<HTMLDivElement | null>
  onPiggyUpdate: (patch: { credits: number; credits_piggy: number }) => void
  onPiggyTransferPending?: (pending: boolean) => void
}

export default function ChildHomePiggyBank({
  availableCredits,
  piggyCredits,
  childId,
  depositEnabled,
  onPiggyUpdate,
  onPiggyTransferPending,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [portalReady, setPortalReady] = useState(false)
  const [piggyBounceKey, setPiggyBounceKey] = useState(0)
  const [creditsBounceKey, setCreditsBounceKey] = useState(0)
  const [transferHintVisible, setTransferHintVisible] = useState(false)
  const [flyCoins, setFlyCoins] = useState<FlyCoin[]>([])
  const flyIdRef = useRef(0)
  const creditsPanelRef = useRef<HTMLDivElement>(null)
  const creditsCoinRef = useRef<HTMLImageElement>(null)
  const piggyTargetRef = useRef<HTMLDivElement>(null)
  const optimisticCreditsRef = useRef(availableCredits)
  const optimisticPiggyRef = useRef(piggyCredits)
  const apiQueueRef = useRef(Promise.resolve())
  const pendingTransferCountRef = useRef(0)
  const lastConfirmedBalanceRef = useRef<{ credits: number; credits_piggy: number } | null>(null)
  const [piggySrc, setPiggySrc] = useState(piggyBankVisualUrlFromSavedCredits(piggyCredits))

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    // 빠르게 여러 번 누른 동안에는 부모로 전달된 낙관적 숫자가 다시 props로 들어옵니다.
    // 이 값을 서버 확정값으로 오인해 진행 중인 입력 기준을 되돌리지 않습니다.
    if (pendingTransferCountRef.current > 0) return
    optimisticCreditsRef.current = availableCredits
    optimisticPiggyRef.current = piggyCredits
  }, [availableCredits, piggyCredits])

  useEffect(() => {
    setPiggySrc(piggyBankVisualUrlFromSavedCredits(piggyCredits))
  }, [piggyCredits])

  const spawnFlyCoin = useCallback((kind: TransferKind) => {
    const piggyEl = piggyTargetRef.current
    const creditsEl = creditsPanelRef.current
    const creditsCoinEl = creditsCoinRef.current
    if (!piggyEl || !creditsEl) return

    const piggy = piggyEl.getBoundingClientRect()
    const credits = creditsEl.getBoundingClientRect()
    const coinImg = creditsCoinEl?.getBoundingClientRect()
    const piggyCenterX = piggy.left + piggy.width / 2
    const piggySlotY = piggy.top + piggy.height * PIGGY_SLOT_Y_RATIO
    /** 왼쪽 크레딧 동전 그림 중심 — 없으면 패널 중심으로 폴백 */
    const creditsCoinCenterX = coinImg ? coinImg.left + coinImg.width / 2 : credits.left + credits.width / 2
    const creditsCoinCenterY = coinImg ? coinImg.top + coinImg.height / 2 : credits.top + credits.height / 2

    const fromX = kind === 'credits_to_piggy' ? creditsCoinCenterX : piggyCenterX
    const fromY = kind === 'credits_to_piggy' ? creditsCoinCenterY : piggySlotY
    const toX = kind === 'credits_to_piggy' ? piggyCenterX : creditsCoinCenterX
    const toY = kind === 'credits_to_piggy' ? piggySlotY : creditsCoinCenterY

    const id = ++flyIdRef.current
    setFlyCoins((prev) => [...prev, { id, fromX, fromY, toX, toY }])
    window.setTimeout(() => {
      setFlyCoins((prev) => prev.filter((c) => c.id !== id))
    }, 580)
  }, [])

  const rollbackOptimistic = useCallback(
    (kind: TransferKind) => {
      if (kind === 'credits_to_piggy') {
        optimisticCreditsRef.current += 1
        optimisticPiggyRef.current = Math.max(0, optimisticPiggyRef.current - 1)
      } else {
        optimisticCreditsRef.current = Math.max(0, optimisticCreditsRef.current - 1)
        optimisticPiggyRef.current += 1
      }
      onPiggyUpdate({
        credits: optimisticCreditsRef.current,
        credits_piggy: optimisticPiggyRef.current,
      })
    },
    [onPiggyUpdate],
  )

  const syncTransferToServer = useCallback(
    async (kind: TransferKind) => {
      try {
        const res = await fetch('/api/child/credits/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          amount: 1,
          childId,
        }),
      })
      const json = (await res.json()) as {
        error?: string
        credits?: number
        credits_piggy?: number
      }
      if (
        !res.ok ||
        json.error ||
        typeof json.credits !== 'number' ||
        typeof json.credits_piggy !== 'number'
      ) {
        rollbackOptimistic(kind)
        console.warn('[ChildHomePiggyBank] transfer failed', json.error ?? res.status)
        return
      }
      // 앞선 요청의 응답은 뒤에 대기 중인 탭을 포함하지 않은 값입니다.
      // 마지막 요청까지 끝났을 때만 서버 확정값을 화면에 반영합니다.
      lastConfirmedBalanceRef.current = {
        credits: json.credits,
        credits_piggy: json.credits_piggy,
      }
    } finally {
      pendingTransferCountRef.current = Math.max(0, pendingTransferCountRef.current - 1)
      if (pendingTransferCountRef.current === 0) {
        const confirmed = lastConfirmedBalanceRef.current
        if (confirmed) {
          optimisticCreditsRef.current = confirmed.credits
          optimisticPiggyRef.current = confirmed.credits_piggy
          onPiggyUpdate(confirmed)
          lastConfirmedBalanceRef.current = null
        }
        onPiggyTransferPending?.(false)
      }
    }
    },
    [childId, onPiggyUpdate, rollbackOptimistic],
  )

  const enqueueTransfer = useCallback(
    (kind: TransferKind) => {
      pendingTransferCountRef.current += 1
      if (pendingTransferCountRef.current === 1) {
        lastConfirmedBalanceRef.current = null
        onPiggyTransferPending?.(true)
      }
      apiQueueRef.current = apiQueueRef.current
        .then(() => syncTransferToServer(kind))
        .catch((err) => {
          console.warn('[ChildHomePiggyBank] transfer queue failed', err)
        })
    },
    [onPiggyTransferPending, syncTransferToServer],
  )

  const depositOne = useCallback(() => {
    if (!depositEnabled || optimisticCreditsRef.current < 1) return

    const prevPiggy = optimisticPiggyRef.current
    const nextCredits = optimisticCreditsRef.current - 1
    const nextPiggy = optimisticPiggyRef.current + 1
    optimisticCreditsRef.current = nextCredits
    optimisticPiggyRef.current = nextPiggy

    playDepositSound()
    spawnFlyCoin('credits_to_piggy')
    setTransferHintVisible(false)
    markPiggyTransferHintSeen(childId)
    markPiggyBonusPeriodStarted(childId)

    const prevFrame = piggyBankVisualFrameIndexFromSavedCredits(prevPiggy)
    const nextFrame = piggyBankVisualFrameIndexFromSavedCredits(nextPiggy)
    onPiggyUpdate({ credits: nextCredits, credits_piggy: nextPiggy })
    if (nextFrame > prevFrame) playPiggyStageUpSound()
    setPiggyBounceKey((k) => k + 1)

    enqueueTransfer('credits_to_piggy')
  }, [depositEnabled, childId, onPiggyUpdate, spawnFlyCoin, enqueueTransfer])

  const withdrawOne = useCallback(() => {
    if (!depositEnabled || optimisticPiggyRef.current < 1) return

    const nextCredits = optimisticCreditsRef.current + 1
    const nextPiggy = optimisticPiggyRef.current - 1
    optimisticCreditsRef.current = nextCredits
    optimisticPiggyRef.current = nextPiggy

    playDepositSound()
    spawnFlyCoin('piggy_to_credits')
    setTransferHintVisible(false)
    markPiggyTransferHintSeen(childId)
    onPiggyUpdate({ credits: nextCredits, credits_piggy: nextPiggy })
    setCreditsBounceKey((k) => k + 1)

    enqueueTransfer('piggy_to_credits')
  }, [depositEnabled, onPiggyUpdate, spawnFlyCoin, enqueueTransfer])

  const openSheet = useCallback(() => {
    setSheetOpen(true)
    if (!depositEnabled) {
      setTransferHintVisible(false)
      return
    }
    const showHint = !hasSeenPiggyTransferHint(childId)
    setTransferHintVisible(showHint)
    if (showHint) markPiggyTransferHintSeen(childId)
  }, [childId, depositEnabled])

  const canDeposit = depositEnabled && availableCredits >= 1
  const canWithdraw = depositEnabled && piggyCredits >= 1

  const flyLayer =
    flyCoins.length > 0 && portalReady ? (
      <div className="pointer-events-none fixed inset-0 z-[200]" aria-hidden>
        {flyCoins.map((coin) => (
          <img
            key={coin.id}
            src={CHILD_CREDIT_COIN_PNG_SRC}
            alt=""
            width={22}
            height={22}
            className="absolute h-[22px] w-[22px] object-contain drop-shadow-md"
            style={
              {
                left: coin.fromX,
                top: coin.fromY,
                marginLeft: -11,
                marginTop: -11,
                animation: 'piggyCreditFly 0.55s ease-in forwards',
                '--fly-dx': `${coin.toX - coin.fromX}px`,
                '--fly-dy': `${coin.toY - coin.fromY}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    ) : null

  const popup =
    sheetOpen && portalReady ? (
      <div className="fixed inset-0 z-[175] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="저금하기">
        <button
          type="button"
          className="absolute inset-0 bg-black/35"
          aria-label="저금통 닫기"
          onClick={() => setSheetOpen(false)}
        />
        <div className="relative z-[1] flex w-full max-w-sm flex-col rounded-3xl border border-amber-100 bg-gradient-to-b from-amber-50 to-white p-5 shadow-xl">
          <h2 className="text-center text-lg font-black text-amber-900">저금하기</h2>
          <p className="mb-4 mt-2 text-center text-xs font-semibold text-amber-900/90">
            저금을 하면 일주일에 1번 보너스 크레딧이 생겨요!
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={withdrawOne}
              disabled={!canWithdraw}
              className="flex min-h-[11.5rem] flex-col items-center rounded-2xl border-2 border-sky-100/90 bg-white/90 px-2 py-3 shadow-sm transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45"
              aria-label="저금통에서 크레딧 꺼내기"
            >
              <p className="text-center text-[11px] font-bold leading-tight text-amber-800/75">크레딧</p>
              <div
                ref={creditsPanelRef}
                key={creditsBounceKey}
                className="mt-3 flex flex-1 flex-col items-center justify-center"
                style={{
                  animation: creditsBounceKey ? 'piggyDepositBump 0.55s ease-out' : undefined,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={creditsCoinRef}
                  src={CHILD_CREDIT_COIN_PNG_SRC}
                  alt=""
                  width={72}
                  height={72}
                  className="h-[4.5rem] w-[4.5rem] object-contain drop-shadow-md"
                  draggable={false}
                />
                <span
                  className="mt-2 font-black tabular-nums leading-none text-[#7A4F00]"
                  style={{ fontSize: 24, letterSpacing: '-0.5px' }}
                >
                  {formatChildCreditsDisplay(availableCredits)}
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={depositOne}
              disabled={!canDeposit}
              className="flex min-h-[11.5rem] flex-col items-center rounded-2xl border-2 border-amber-100/90 bg-white/90 px-2 py-3 shadow-sm transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45"
              aria-label={depositEnabled ? '저금통에 크레딧 넣기' : `저금통 — 레벨 ${PIGGY_BANK_UNLOCK_MIN_LEVEL}부터`}
            >
              <p className="text-center text-[11px] font-bold leading-tight text-amber-800/75">
                저금통에 모은 크레딧
              </p>
              <div
                ref={piggyTargetRef}
                key={piggyBounceKey}
                className="mt-3 flex flex-1 flex-col items-center justify-center"
                style={{
                  animation: piggyBounceKey ? 'piggyDepositBump 0.55s ease-out' : undefined,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={piggySrc}
                  alt=""
                  width={72}
                  height={72}
                  className="h-[4.5rem] w-[4.5rem] object-contain drop-shadow-md"
                  draggable={false}
                  onError={() => setPiggySrc('/assets/img/items/rewards/piggybank/piggy_bank1.png')}
                />
                <span
                  className="mt-2 font-black tabular-nums leading-none text-[#7A4F00]"
                  style={{ fontSize: 24, letterSpacing: '-0.5px' }}
                >
                  {formatChildCreditsDisplay(piggyCredits)}
                </span>
              </div>
            </button>
          </div>

          {transferHintVisible && depositEnabled ? (
            <p className="mt-3 text-center text-xs font-black text-gray-600">
              저금통을 누르면 모으고, 크레딧을 누르면 꺼내요
            </p>
          ) : !depositEnabled ? (
            <p className="mt-3 text-center text-xs font-black text-gray-600">
              {`레벨 ${PIGGY_BANK_UNLOCK_MIN_LEVEL}부터 저금할 수 있어요`}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            className="mt-4 w-full rounded-xl bg-gray-100 py-2.5 text-sm font-bold text-gray-700"
          >
            닫기
          </button>
        </div>
        <style>{`
          @keyframes piggyDepositBump {
            0% { transform: scale(1); }
            35% { transform: scale(1.08); }
            100% { transform: scale(1); }
          }
          @keyframes piggyCreditFly {
            0% {
              transform: translate(0, 0) scale(1.1);
              opacity: 1;
            }
            100% {
              transform: translate(var(--fly-dx), var(--fly-dy)) scale(0.9);
              opacity: 0.4;
            }
          }
        `}</style>
      </div>
    ) : null

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className="relative flex shrink-0 flex-col items-center border-0 bg-transparent p-0 transition-transform active:scale-95"
        aria-label="저금통 열기"
      >
        <div className="relative h-10 w-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={piggySrc}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 object-contain drop-shadow-md"
            draggable={false}
            onError={() => setPiggySrc('/assets/img/items/rewards/piggybank/piggy_bank1.png')}
          />
        </div>
      </button>
      {portalReady && flyLayer ? createPortal(flyLayer, document.body) : null}
      {portalReady && popup ? createPortal(popup, document.body) : null}
    </>
  )
}
