'use client'

import { useMemo, useState } from 'react'
import { useFeatureUnlockCelebrationSound } from '@/hooks/useFeatureUnlockCelebrationSound'

type Props = {
  open: boolean
  onClose: () => void
  onSkipTutorial: () => void
}

type TutorialStep = {
  title: string
  description: string
  emoji: string
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: '1. 미션 완료',
    description: '오늘의 미션 카드를 누르면 완료가 되고,',
    emoji: '✅',
  },
  {
    title: '2. 코인 획득',
    description: '완료 보상 코인이 레벨 카드에 쌓여요!',
    emoji: '🪙',
  },
  {
    title: '3. 저금통에 저장',
    description: '저금통을 눌러 코인을 차곡차곡 모아봐요.',
    emoji: '🐷',
  },
  {
    title: '4. 보상 얻기',
    description: '모은 코인으로 원하는 보상을 고를 수 있어요.',
    emoji: '🎁',
  },
]

/**
 * 저금통 기능 해금 직후 보여주는 2단계 모달
 * - 1단계: 해금 축하 팝업
 * - 2단계: 4스텝 미니 튜토리얼(스킵 가능)
 */
export default function PiggyBankUnlockFlowModal({ open, onClose, onSkipTutorial }: Props) {
  const [phase, setPhase] = useState<'unlock' | 'tutorial'>('unlock')
  const [step, setStep] = useState(0)

  useFeatureUnlockCelebrationSound(open)

  const current = useMemo(() => TUTORIAL_STEPS[step] ?? TUTORIAL_STEPS[0], [step])
  const isLast = step >= TUTORIAL_STEPS.length - 1

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="저금통 해금 안내">
      <style>{`
        @keyframes piggyPop {
          0% { transform: scale(0.75) rotate(-8deg); opacity: 0; }
          60% { transform: scale(1.08) rotate(4deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes pulseTap {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>

      <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl ring-2 ring-amber-100">
        {phase === 'unlock' ? (
          <div className="flex flex-col items-center text-center">
            <div className="text-6xl" style={{ animation: 'piggyPop 540ms ease-out forwards' }} aria-hidden>
              🐷
            </div>
            <p className="mt-3 text-lg font-black text-amber-700">축하해! 저금통이 열렸어요!</p>
            <p className="mt-2 text-sm font-semibold text-gray-600">
              이제 미션을 완료하고 코인을 모아볼 수 있어요!
            </p>
            <button
              type="button"
              onClick={() => {
                setPhase('tutorial')
                setStep(0)
              }}
              className="mt-5 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 py-2.5 text-sm font-black text-white shadow-md"
            >
              사용법 보기
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 text-xs font-bold text-gray-400 underline underline-offset-2"
            >
              나중에 볼게요
            </button>
          </div>
        ) : (
          <div>
            <p className="text-center text-xs font-bold text-gray-400">
              저금통 놀이 가이드 {step + 1}/{TUTORIAL_STEPS.length}
            </p>
            <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-center">
              <div className="text-4xl" aria-hidden>
                {current.emoji}
              </div>
              <p className="mt-2 text-base font-black text-gray-800">{current.title}</p>
              <p className="mt-1 text-sm font-semibold text-gray-600">{current.description}</p>
              {current.emoji === '🐷' ? (
                <button
                  type="button"
                  className="mt-3 inline-flex items-center rounded-full bg-pink-100 px-4 py-1.5 text-xs font-black text-pink-700"
                  style={{ animation: 'pulseTap 900ms ease-in-out infinite' }}
                >
                  탭해서 저금하기
                </button>
              ) : null}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onSkipTutorial()
                  onClose()
                }}
                className="flex-1 rounded-2xl border border-gray-200 py-2.5 text-sm font-bold text-gray-500"
              >
                튜토리얼 건너뛰기
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isLast) {
                    onClose()
                    return
                  }
                  setStep((prev) => Math.min(prev + 1, TUTORIAL_STEPS.length - 1))
                }}
                className="flex-1 rounded-2xl bg-brand-blue py-2.5 text-sm font-black text-white shadow"
              >
                {isLast ? '시작하기' : '다음'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
