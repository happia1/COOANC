'use client'

/**
 * AllMissionCompleteOverlay — 오늘 미션을 모두 완료했을 때 뜨는 축하 전체 화면
 *
 * 비개발자 설명:
 * - 반투명 배경 위에 “미션 완료!” 메시지와 오늘 번 코인 합을 보여줍니다.
 * - 화면이 켜질 때는 소리 없이 색종이(컨페티)만 터집니다.
 * - [내일 만나자! 잘자~]를 누르면 잘 준비 음성 후 수면 모드로 넘어갑니다(onSleep).
 */

import { useEffect } from 'react'
import confetti from 'canvas-confetti'
import { playAudio, CHILD_AUDIO } from '@/lib/childAudio'

interface Props {
  /** 오늘(이 세션에서) 미션으로 번 코인의 합 — 숫자 앞에 + 로 표시 */
  todayCredits: number
  /** 화면에 보일 아이 이름 */
  childName: string
  /** 잘 준비 음성 재생 후 수면 모드로 전환 */
  onSleep: () => void
}

export default function AllMissionCompleteOverlay({
  todayCredits,
  childName,
  onSleep,
}: Props) {
  useEffect(() => {
    // 화면이 뜨고 아주 잠시 후에 색종이를 쏴서, 레이아웃이 잡힌 뒤에 터지게 합니다 (팝업 오픈 시 음성 없음)
    const t1 = setTimeout(() => {
      confetti({
        particleCount: 80,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.75 },
        colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'],
        zIndex: 9999,
      })
      confetti({
        particleCount: 80,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.75 },
        colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'],
        zIndex: 9999,
      })
    }, 100)

    const t2 = setTimeout(() => {
      confetti({
        particleCount: 150,
        spread: 120,
        origin: { x: 0.5, y: 0.4 },
        colors: ['#FFD700', '#FF69B4', '#7B68EE', '#00CED1', '#FF6347'],
        zIndex: 9999,
      })
    }, 300)

    const t3 = setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 80,
        origin: { x: 0.3, y: 0.5 },
        colors: ['#FFD700', '#FF6B6B'],
        zIndex: 9999,
      })
      confetti({
        particleCount: 60,
        spread: 80,
        origin: { x: 0.7, y: 0.5 },
        colors: ['#4ECDC4', '#45B7D1'],
        zIndex: 9999,
      })
    }, 1000)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="all-mission-complete-title"
    >
      <div
        className="bg-white rounded-3xl px-8 pt-6 pb-10 mx-6 text-center shadow-2xl w-full max-w-sm"
        style={{ animation: 'celebratePopIn 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}
      >
        <p id="all-mission-complete-title" className="text-2xl font-black text-gray-800 mb-1">
          미션 완료!
        </p>
        <p className="text-sm text-gray-400 mb-6">
          {childName}(이)가 오늘 모든 미션을 해냈어요!
        </p>

        <div
          className="rounded-2xl py-5 px-6 mb-6"
          style={{
            background: 'linear-gradient(135deg, #FFF9E6, #FFF3CC)',
            border: '2px solid #FFD700',
          }}
        >
          <p className="text-xs font-bold text-yellow-600 mb-2 tracking-wide">오늘 번 코인</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-4xl" aria-hidden>
              🪙
            </span>
            <span className="text-5xl font-black" style={{ color: '#D4A000' }}>
              +{todayCredits}
            </span>
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-7">내일도 미션이 기다리고 있어요! 🌟</p>

        <button
          type="button"
          onClick={() => {
            playAudio(CHILD_AUDIO.sleepReady)
            window.setTimeout(() => onSleep(), 800)
          }}
          className="w-full py-4 rounded-2xl font-black text-white text-lg
                     active:scale-95 transition-transform"
          style={{
            background: 'linear-gradient(135deg, #7C6CF8, #A78BFA)',
            boxShadow: '0 4px 20px rgba(124,108,248,0.4)',
          }}
        >
          내일 만나자! 잘자~ 🌙
        </button>
      </div>
    </div>
  )
}
