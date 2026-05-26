'use client'

/**
 * 자녀 홈 발 옆 저금통 — 탭 시 팝업에서 지갑 크레딧 확인·저금(지갑→저금통)합니다.
 *
 * 비개발자 설명:
 * - 바깥에는 현재 저금통에 쌓인 만큼에 맞는 돼지 그림이 보입니다(최대 1000까지 14단계).
 * - 팝업에서는 「지갑에 있는 크레딧」 숫자를 크게 보여 주고, 저금통을 누르면 1코인씩 저금합니다.
 * - 레벨이 낮거나 나이가 어려 멀티 버킷이 아니면 저금 버튼 대신 안내만 나옵니다.
 */

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { piggyBankVisualFrameIndexFromSavedCredits, piggyBankVisualUrlFromSavedCredits } from '@/lib/piggyBankHomeStage'

/** 사용자 제공 효과음 경로 — 파일을 `public` 아래에 두면 재생됩니다. */
export const CHILD_PIGGY_DEPOSIT_SOUND_SRC =
  '/assets/audio/missions/success_reward-fairy-arcade-sparkle-866.wav' as const
/** 저금통 PNG 단계가 올라갈 때(14단계 중 다음 그림으로 넘어갈 때) 재생할 효과음 */
export const CHILD_PIGGY_STAGE_UP_SOUND_SRC =
  '/assets/audio/effects/level_up-magic-festive-melody-2986.wav' as const

function playDepositSound() {
  try {
    const audio = new Audio(CHILD_PIGGY_DEPOSIT_SOUND_SRC)
    audio.volume = 0.85
    void audio.play().catch(() => {
      /* 브라우저 자동재생 정책 등으로 실패해도 조용히 무시 */
    })
  } catch {
    /* noop */
  }
}

function playPiggyStageUpSound() {
  try {
    const audio = new Audio(CHILD_PIGGY_STAGE_UP_SOUND_SRC)
    audio.volume = 0.92
    void audio.play().catch(() => {
      /* 브라우저 자동재생 정책 등으로 실패해도 조용히 무시 */
    })
  } catch {
    /* noop */
  }
}

type Props = {
  walletCredits: number
  piggyCredits: number
  childId: string
  /** false 이면 지갑/저금 분리 없음 — 저금 API 비활성 */
  multiBucket: boolean
  /** 저금 성공 후 상단 통계만 맞추면 됩니다(`credits` 합계는 변하지 않음). */
  onWalletPiggyUpdate: (patch: { credits_wallet: number; credits_piggy: number }) => void
}

export default function ChildHomePiggyBank({
  walletCredits,
  piggyCredits,
  childId,
  multiBucket,
  onWalletPiggyUpdate,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [portalReady, setPortalReady] = useState(false)
  const [busy, setBusy] = useState(false)
  /** 저금 직후 돼지에 살짝 튀는 연출 */
  const [bounceKey, setBounceKey] = useState(0)
  /** 지갑 → 저금통으로 코인이 내려가는 짧은 이펙트 */
  const [coinFlyKey, setCoinFlyKey] = useState(0)
  /** 이미지 로드 실패 시 항상 1단계 그림으로 폴백 */
  const [piggySrc, setPiggySrc] = useState(piggyBankVisualUrlFromSavedCredits(piggyCredits))

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    setPiggySrc(piggyBankVisualUrlFromSavedCredits(piggyCredits))
  }, [piggyCredits])

  const depositOne = useCallback(async () => {
    if (!multiBucket || busy || walletCredits < 1) return
    playDepositSound()
    setBusy(true)
    try {
      const res = await fetch('/api/child/credits/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'wallet_to_piggy',
          amount: 1,
          childId,
        }),
      })
      const json = (await res.json()) as {
        error?: string
        credits_wallet?: number
        credits_piggy?: number
      }
      if (!res.ok || json.error) {
        console.warn('[ChildHomePiggyBank] transfer failed', json.error ?? res.status)
        return
      }
      if (typeof json.credits_wallet === 'number' && typeof json.credits_piggy === 'number') {
        const prevFrame = piggyBankVisualFrameIndexFromSavedCredits(piggyCredits)
        const nextFrame = piggyBankVisualFrameIndexFromSavedCredits(json.credits_piggy)
        onWalletPiggyUpdate({
          credits_wallet: json.credits_wallet,
          credits_piggy: json.credits_piggy,
        })
        // 실제로 저금통 그림 단계가 올라간 경우에만 레벨업 사운드를 재생합니다.
        if (nextFrame > prevFrame) {
          playPiggyStageUpSound()
        }
        setCoinFlyKey((k) => k + 1)
        setBounceKey((k) => k + 1)
      }
    } finally {
      setBusy(false)
    }
  }, [multiBucket, busy, walletCredits, childId, onWalletPiggyUpdate])

  const popup =
    sheetOpen && portalReady ? (
      <div className="fixed inset-0 z-[175] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="저금통">
        <button
          type="button"
          className="absolute inset-0 bg-black/35"
          aria-label="저금통 닫기"
          onClick={() => setSheetOpen(false)}
        />
        <div className="relative z-[1] w-full max-w-xs rounded-2xl border border-amber-100 bg-white p-4 shadow-xl">
          <p className="text-center text-xs font-bold text-amber-800/90">저금통</p>
          <p className="mt-1 text-center text-2xl font-black tabular-nums text-amber-950">
            {piggyCredits.toLocaleString('ko-KR')}
          </p>

          <button
            type="button"
            onClick={() => void depositOne()}
            disabled={!multiBucket || busy || walletCredits < 1}
            className="relative mx-auto mt-4 flex w-36 flex-col items-center gap-1 rounded-xl border-0 bg-transparent p-2 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
            aria-label={multiBucket ? '저금통에 크레딧 넣기' : '저금통'}
          >
            {coinFlyKey > 0 ? (
              <span
                key={coinFlyKey}
                className="pointer-events-none absolute left-1/2 top-[-8px] text-2xl leading-none"
                style={{ animation: 'piggyCoinIntoBank 0.55s ease-in forwards' }}
                aria-hidden
              >
                🪙
              </span>
            ) : null}
            <div
              key={bounceKey}
              className="relative h-28 w-28"
              style={{
                animation: bounceKey ? 'piggyDepositBump 0.55s ease-out' : undefined,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={piggySrc}
                alt=""
                width={112}
                height={112}
                className="h-28 w-28 object-contain drop-shadow-md"
                draggable={false}
                onError={() => setPiggySrc('/assets/img/items/rewards/piggybank/piggy_bank1.png')}
              />
            </div>
            <span className="text-[11px] font-black text-gray-600">
              {multiBucket ? '저금통을 눌러 저금 (1씩)' : '레벨 5부터 열려요'}
            </span>
          </button>

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
          @keyframes piggyCoinIntoBank {
            0% {
              transform: translate(-50%, 0) scale(1.1);
              opacity: 1;
            }
            100% {
              transform: translate(-50%, 88px) scale(0.75);
              opacity: 0.25;
            }
          }
        `}</style>
      </div>
    ) : null

  return (
    <>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
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
      {portalReady && popup ? createPortal(popup, document.body) : null}
    </>
  )
}
