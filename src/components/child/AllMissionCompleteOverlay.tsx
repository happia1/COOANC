'use client'

/**
 * AllMissionCompleteOverlay — 오늘 미션을 모두 완료했을 때 뜨는 축하 전체 화면
 *
 * 비개발자 설명:
 * - 반투명 배경 위에 “미션 완료!” 메시지와 오늘 번 코인 합을 보여줍니다.
 * - 화면이 켜질 때는 소리 없이 색종이(컨페티)만 터집니다.
 * - [내일 만나자! 잘자~]를 누르면 잘 준비 음 없이 수면 모드로 넘어갑니다(onSleep).
 */

import { useEffect } from 'react'
import Image from 'next/image'
import confetti from 'canvas-confetti'

interface Props {
  /** 오늘(이 세션에서) 미션으로 번 코인의 합 — 숫자 앞에 + 로 표시 */
  todayCredits: number
  /** 수면 모드(잘자 화면)로 전환 */
  onSleep: () => void
}

export default function AllMissionCompleteOverlay({
  todayCredits,
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

        <div
          className="rounded-2xl py-5 px-6 mb-6"
          style={{
            background: 'linear-gradient(135deg, #FFF9E6, #FFF3CC)',
            border: '2px solid #FFD700',
          }}
        >
          {/* 중앙 축하 이미지는 요청한 온보딩 축하 PNG를 그대로 사용합니다. */}
          <div className="mb-3 flex items-center justify-center">
            <Image
              src="/assets/img/characters/onboarding/congrats.png"
              alt="미션 완료 축하 이미지"
              width={180}
              height={180}
              className="h-auto w-[160px] select-none object-contain"
              priority
            />
          </div>
          <div className="flex items-center justify-center gap-2">
            {/* 홈 상단 카드와 동일한 크레딧 코인 이미지를 사용합니다. */}
            <img
              src={`/assets/img/common/ui/${encodeURIComponent('크레딧.png')}`}
              alt=""
              aria-hidden
              className="h-10 w-10 select-none object-contain"
              draggable={false}
            />
            <span className="text-5xl font-black" style={{ color: '#D4A000' }}>
              +{todayCredits}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onSleep()
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
