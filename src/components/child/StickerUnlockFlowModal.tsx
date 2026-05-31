'use client'

import { useMemo, useState } from 'react'
import { useFeatureUnlockCelebrationSound } from '@/hooks/useFeatureUnlockCelebrationSound'

const STICKER_ICON_SRC = '/assets/img/common/ui/luckybox.png'

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
    description: '오늘의 미션을 끝내면 하트와 칭찬 스티커를 받을 수 있어요.',
    emoji: '✅',
  },
  {
    title: '2. 스티커 아이콘',
    description: '화면 오른쪽 위 선물 상자 아이콘을 눌러 스티커 판을 열어요.',
    emoji: '🎁',
  },
  {
    title: '3. 곰돌이 판',
    description: '받은 스티커를 곰돌이 판 칸에 붙여 성취를 모아요.',
    emoji: '🐻',
  },
  {
    title: '4. 20칸 완주',
    description: '칸을 다 채우면 새 판으로 다시 시작할 수 있어요!',
    emoji: '⭐',
  },
]

/**
 * 칭찬 스티커(우측 상단 아이콘) 해금 직후 보여주는 2단계 모달
 * - 1단계: 해금 축하 팝업
 * - 2단계: 4스텝 미니 튜토리얼(스킵 가능)
 */
export default function StickerUnlockFlowModal({ open, onClose, onSkipTutorial }: Props) {
  const [phase, setPhase] = useState<'unlock' | 'tutorial'>('unlock')
  const [step, setStep] = useState(0)

  useFeatureUnlockCelebrationSound(open)

  const current = useMemo(() => TUTORIAL_STEPS[step] ?? TUTORIAL_STEPS[0], [step])
  const isLast = step >= TUTORIAL_STEPS.length - 1

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="칭찬 스티커 해금 안내"
    >
      <style>{`
        @keyframes stickerPop {
          0% { transform: scale(0.75) rotate(-8deg); opacity: 0; }
          60% { transform: scale(1.08) rotate(4deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
      `}</style>

      <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl ring-2 ring-pink-100">
        {phase === 'unlock' ? (
          <div className="flex flex-col items-center text-center">
            <div
              className="relative h-20 w-20"
              style={{ animation: 'stickerPop 540ms ease-out forwards' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={STICKER_ICON_SRC} alt="" className="h-full w-full object-contain drop-shadow-md" />
            </div>
            <p className="mt-3 text-lg font-black text-pink-700">축하해! 칭찬 스티커가 열렸어요!</p>
            <p className="mt-2 text-sm font-semibold text-gray-600">
              이제 오른쪽 위 아이콘으로 스티커 판을 열 수 있어요!
            </p>
            <button
              type="button"
              onClick={() => {
                setPhase('tutorial')
                setStep(0)
              }}
              className="mt-5 w-full rounded-2xl bg-gradient-to-r from-pink-400 to-rose-400 py-2.5 text-sm font-black text-white shadow-md"
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
              칭찬 스티커 가이드 {step + 1}/{TUTORIAL_STEPS.length}
            </p>
            <div className="mt-3 rounded-2xl border border-pink-100 bg-pink-50 p-4 text-center">
              <div className="text-4xl" aria-hidden>
                {current.emoji}
              </div>
              <p className="mt-2 text-base font-black text-gray-800">{current.title}</p>
              <p className="mt-1 text-sm font-semibold text-gray-600">{current.description}</p>
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
