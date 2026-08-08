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
import { PIGGY_BANK_UNLOCK_MIN_LEVEL } from '@/constants/childAgeConfig'
import { CHILD_CREDIT_COIN_PNG_SRC, formatChildCreditsDisplay } from '@/lib/childCreditDisplay'
import { claimPiggyBonus } from '@/lib/piggyBankBonus'

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

/**
 * 한 번에 옮길 수 있는 묶음.
 * 1개씩만 옮길 수 있으면 1000개를 저금하는 데 1000번을 눌러야 해서 추가했습니다.
 * 서버 요청 수도 그만큼 줄어듭니다.
 */
const TRANSFER_CHUNKS = [10, 50, 100] as const

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
  /**
   * 레벨 블록의 크레딧 표시 위치.
   * 옮기기는 팝업 안 좌·우 패널 좌표를 쓰고, **홈에서 이자 코인을 받을 때**
   * 코인이 날아갈 목적지로 이 위치를 씁니다(팝업이 닫혀 있어 패널 좌표가 없기 때문).
   */
  levelCreditRef?: React.RefObject<HTMLDivElement | null>
  onPiggyUpdate: (patch: { credits: number; credits_piggy: number }) => void
  onPiggyTransferPending?: (pending: boolean) => void
  /** 아직 받아 가지 않은 이자 개수 — 저금통 위에 이 수만큼 반짝이는 코인이 뜹니다 */
  bonusPending?: number
  /** 코인을 눌러 1개 받았을 때: 남은 개수와 늘어난 크레딧을 부모에게 알립니다 */
  onBonusClaimed?: (next: { pending: number; credits: number }) => void
}

export default function ChildHomePiggyBank({
  availableCredits,
  piggyCredits,
  childId,
  depositEnabled,
  levelCreditRef,
  onPiggyUpdate,
  onPiggyTransferPending,
  bonusPending = 0,
  onBonusClaimed,
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
  /** 저금통 위에 떠 있는(아직 안 받은) 보너스 코인 개수 — 낙관적으로 먼저 줄입니다 */
  const [bonusCount, setBonusCount] = useState(bonusPending)
  const bonusOptimisticRef = useRef(bonusPending)
  const bonusQueueRef = useRef(Promise.resolve())
  const pendingClaimCountRef = useRef(0)

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

  useEffect(() => {
    // 연타 중에는 낙관적으로 줄여 둔 개수를 서버 왕복 값으로 되돌리지 않습니다.
    if (pendingClaimCountRef.current > 0) return
    bonusOptimisticRef.current = bonusPending
    setBonusCount(bonusPending)
  }, [bonusPending])

  /** 임의의 좌표에서 크레딧 동전 그림까지 코인을 날립니다 */
  const spawnFlyCoinAt = useCallback((fromX: number, fromY: number, toX: number, toY: number) => {
    const id = ++flyIdRef.current
    setFlyCoins((prev) => [...prev, { id, fromX, fromY, toX, toY }])
    window.setTimeout(() => {
      setFlyCoins((prev) => prev.filter((c) => c.id !== id))
    }, 580)
  }, [])

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

    spawnFlyCoinAt(fromX, fromY, toX, toY)
  }, [spawnFlyCoinAt])

  const rollbackOptimistic = useCallback(
    (kind: TransferKind, amount: number) => {
      if (kind === 'credits_to_piggy') {
        optimisticCreditsRef.current += amount
        optimisticPiggyRef.current = Math.max(0, optimisticPiggyRef.current - amount)
      } else {
        optimisticCreditsRef.current = Math.max(0, optimisticCreditsRef.current - amount)
        optimisticPiggyRef.current += amount
      }
      onPiggyUpdate({
        credits: optimisticCreditsRef.current,
        credits_piggy: optimisticPiggyRef.current,
      })
    },
    [onPiggyUpdate],
  )

  const syncTransferToServer = useCallback(
    async (kind: TransferKind, amount: number) => {
      try {
        const res = await fetch('/api/child/credits/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          amount,
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
        rollbackOptimistic(kind, amount)
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
    (kind: TransferKind, amount: number) => {
      pendingTransferCountRef.current += 1
      if (pendingTransferCountRef.current === 1) {
        lastConfirmedBalanceRef.current = null
        onPiggyTransferPending?.(true)
      }
      apiQueueRef.current = apiQueueRef.current
        .then(() => syncTransferToServer(kind, amount))
        .catch((err) => {
          console.warn('[ChildHomePiggyBank] transfer queue failed', err)
        })
    },
    [onPiggyTransferPending, syncTransferToServer],
  )

  /**
   * 저금통에 넣기 — `amount` 만큼 한 번에(기본 1).
   * 가진 것보다 많이 눌러도 가진 만큼만 옮깁니다.
   */
  const deposit = useCallback((amountRaw = 1) => {
    const amount = Math.min(Math.max(1, Math.floor(amountRaw)), optimisticCreditsRef.current)
    if (!depositEnabled || amount < 1) return

    const prevPiggy = optimisticPiggyRef.current
    const nextCredits = optimisticCreditsRef.current - amount
    const nextPiggy = optimisticPiggyRef.current + amount
    optimisticCreditsRef.current = nextCredits
    optimisticPiggyRef.current = nextPiggy

    playDepositSound()
    spawnFlyCoin('credits_to_piggy')
    setTransferHintVisible(false)
    markPiggyTransferHintSeen(childId)

    const prevFrame = piggyBankVisualFrameIndexFromSavedCredits(prevPiggy)
    const nextFrame = piggyBankVisualFrameIndexFromSavedCredits(nextPiggy)
    onPiggyUpdate({ credits: nextCredits, credits_piggy: nextPiggy })
    if (nextFrame > prevFrame) playPiggyStageUpSound()
    setPiggyBounceKey((k) => k + 1)

    enqueueTransfer('credits_to_piggy', amount)
  }, [depositEnabled, childId, onPiggyUpdate, spawnFlyCoin, enqueueTransfer])

  /** 저금통에서 꺼내기 — `amount` 만큼 한 번에(기본 1). 있는 만큼만 나옵니다. */
  const withdraw = useCallback((amountRaw = 1) => {
    const amount = Math.min(Math.max(1, Math.floor(amountRaw)), optimisticPiggyRef.current)
    if (!depositEnabled || amount < 1) return

    const nextCredits = optimisticCreditsRef.current + amount
    const nextPiggy = optimisticPiggyRef.current - amount
    optimisticCreditsRef.current = nextCredits
    optimisticPiggyRef.current = nextPiggy

    playDepositSound()
    spawnFlyCoin('piggy_to_credits')
    setTransferHintVisible(false)
    markPiggyTransferHintSeen(childId)
    onPiggyUpdate({ credits: nextCredits, credits_piggy: nextPiggy })
    setCreditsBounceKey((k) => k + 1)

    enqueueTransfer('piggy_to_credits', amount)
  }, [depositEnabled, onPiggyUpdate, spawnFlyCoin, enqueueTransfer])

  /**
   * 반짝이는 보너스 코인 1개를 눌러서 받습니다.
   * 누른 코인 자리에서 왼쪽 크레딧 동전으로 날아가며 사라지고, 크레딧이 1 늘어납니다.
   */
  const claimOneBonus = useCallback(
    (originRect: DOMRect) => {
      if (bonusOptimisticRef.current < 1) return

      const nextPending = bonusOptimisticRef.current - 1
      bonusOptimisticRef.current = nextPending
      setBonusCount(nextPending)

      const nextCredits = optimisticCreditsRef.current + 1
      optimisticCreditsRef.current = nextCredits
      onPiggyUpdate({ credits: nextCredits, credits_piggy: optimisticPiggyRef.current })

      /**
       * 코인이 날아갈 목적지 —
       * 팝업이 열려 있으면 팝업 안 크레딧 동전, 홈에서 눌렀으면 레벨 블록의 크레딧 표시.
       */
      const target =
        creditsCoinRef.current?.getBoundingClientRect() ??
        creditsPanelRef.current?.getBoundingClientRect() ??
        levelCreditRef?.current?.getBoundingClientRect()
      if (target) {
        spawnFlyCoinAt(
          originRect.left + originRect.width / 2,
          originRect.top + originRect.height / 2,
          target.left + target.width / 2,
          target.top + target.height / 2,
        )
      }
      playDepositSound()
      setCreditsBounceKey((k) => k + 1)

      pendingClaimCountRef.current += 1
      bonusQueueRef.current = bonusQueueRef.current
        .then(async () => {
          const res = await claimPiggyBonus(childId, 1)
          if (!res || res.claimed < 1) {
            // 서버가 거절(이미 다 받음 등) — 화면을 되돌립니다.
            bonusOptimisticRef.current += 1
            setBonusCount(bonusOptimisticRef.current)
            optimisticCreditsRef.current = Math.max(0, optimisticCreditsRef.current - 1)
            onPiggyUpdate({
              credits: optimisticCreditsRef.current,
              credits_piggy: optimisticPiggyRef.current,
            })
            return
          }
          onBonusClaimed?.({ pending: res.pending, credits: res.credits })
        })
        .catch((err) => {
          console.warn('[ChildHomePiggyBank] 보너스 받기 실패', err)
        })
        .finally(() => {
          pendingClaimCountRef.current = Math.max(0, pendingClaimCountRef.current - 1)
        })
    },
    [childId, levelCreditRef, onBonusClaimed, onPiggyUpdate, spawnFlyCoinAt],
  )

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
          {/**
            * 자녀(미취학 포함)용 문구 — 규칙을 설명하지 않습니다.
            * 이자 코인은 이 팝업이 아니라 **홈 화면 저금통 위**에서 직접 눌러 받습니다.
            */}
          <p className="mb-4 mt-2 text-center text-xs font-semibold text-amber-900/90">
            모으면 선물이 와요!
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => withdraw(1)}
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
              onClick={() => deposit(1)}
              disabled={!canDeposit}
              className="flex min-h-[11.5rem] w-full flex-col items-center rounded-2xl border-2 border-amber-100/90 bg-white/90 px-2 py-3 shadow-sm transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45"
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

          {/**
            * 묶음 옮기기 — 위 두 패널과 같은 좌·우 배치라 어느 쪽으로 가는지 헷갈리지 않습니다.
            * 왼쪽(파랑) = 저금통에서 꺼내기, 오른쪽(노랑) = 저금통에 넣기.
            */}
          {depositEnabled ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-1">
                {TRANSFER_CHUNKS.map((n) => (
                  <button
                    key={`out-${n}`}
                    type="button"
                    onClick={() => withdraw(n)}
                    disabled={piggyCredits < 1}
                    className="min-w-0 flex-1 rounded-lg border border-sky-200 bg-white/90 py-1.5 text-[11px] font-black tabular-nums text-sky-700 shadow-sm transition active:scale-95 disabled:opacity-40"
                    aria-label={`저금통에서 ${n}개 꺼내기`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                {TRANSFER_CHUNKS.map((n) => (
                  <button
                    key={`in-${n}`}
                    type="button"
                    onClick={() => deposit(n)}
                    disabled={availableCredits < 1}
                    className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white/90 py-1.5 text-[11px] font-black tabular-nums text-amber-700 shadow-sm transition active:scale-95 disabled:opacity-40"
                    aria-label={`저금통에 ${n}개 넣기`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {transferHintVisible && depositEnabled ? (
            <p className="mt-3 text-center text-xs font-black text-gray-600">
              저금통을 누르면 모으고, 크레딧을 누르면 꺼내요
              <span className="mt-0.5 block font-bold text-gray-500">
                아래 10·50·100을 누르면 한 번에 옮겨요
              </span>
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
      {/**
        * 홈 저금통 — 저금통을 누르면 옮기기 팝업이 열리고,
        * 저금통 위에 뜬 반짝이는 코인을 누르면 이자를 1개씩 받아 갑니다.
        * (코인은 저금통 버튼 **밖**에 둡니다. 버튼 안에 버튼을 넣을 수 없기 때문입니다.)
        */}
      <div className="relative flex shrink-0 flex-col items-center">
        <button
          type="button"
          onClick={openSheet}
          className="flex shrink-0 flex-col items-center border-0 bg-transparent p-0 transition-transform active:scale-95"
          aria-label="저금통 열기"
        >
          <div className="h-10 w-10">
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
        {/**
          * 받을 이자 — 저금통 중앙 바로 위에 반짝이는 코인 하나를 띄우고,
          * 남은 개수는 그 옆에 작은 숫자로만 붙입니다(배경 알약 없음).
          * 코인을 누를 때마다 1개씩 받아 크레딧으로 날아가고, 0이 되면 사라집니다.
          */}
        {bonusCount > 0 ? (
          <span
            className="pointer-events-none absolute -top-9 left-1/2 -ml-2.5 flex -translate-x-1/2 items-center gap-px"
            style={{ animation: 'piggyBonusSparkle 1.4s ease-in-out infinite' }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                claimOneBonus(e.currentTarget.getBoundingClientRect())
              }}
              aria-label={`보너스 크레딧 받기 (${bonusCount}개 남음)`}
              className="pointer-events-auto border-0 bg-transparent p-0 transition active:scale-90"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={CHILD_CREDIT_COIN_PNG_SRC}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 object-contain"
                style={{ filter: 'drop-shadow(0 0 5px rgba(255,214,80,0.95))' }}
                draggable={false}
              />
            </button>
            {bonusCount > 1 ? (
              <span
                className="text-[8px] font-black leading-none text-amber-900"
                style={{ textShadow: '0 1px 2px rgba(255,255,255,0.95), 0 0 3px rgba(255,255,255,0.9)' }}
              >
                {bonusCount}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
      {/* 저금통 위 코인이 반짝이도록 — 팝업이 닫혀 있어도 필요한 keyframe */}
      <style>{`
        @keyframes piggyBonusSparkle {
          0%, 100% { transform: translateY(0) scale(1); filter: brightness(1); }
          50% { transform: translateY(-3px) scale(1.14); filter: brightness(1.45); }
        }
      `}</style>
      {portalReady && flyLayer ? createPortal(flyLayer, document.body) : null}
      {portalReady && popup ? createPortal(popup, document.body) : null}
    </>
  )
}
