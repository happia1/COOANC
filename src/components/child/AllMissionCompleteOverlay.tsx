'use client'

/**
 * AllMissionCompleteOverlay — 오늘 미션을 모두 완료했을 때 뜨는 축하 전체 화면
 *
 * 비개발자 설명:
 * - 반투명 배경 위에 “미션 완료!” 메시지와 오늘 번 코인 합을 보여줍니다.
 * - 화면이 켜질 때 색종이(컨페티)가 잠시 터지도록 해 기분 좋은 마무리를 합니다.
 * - [좋아! 내일도 할게요]를 누르면 onClose로 닫힙니다.
 */

import { useEffect } from 'react'
import confetti from 'canvas-confetti'

interface Props {
  /** 오늘(이 세션에서) 미션으로 번 코인의 합 — 숫자 앞에 + 로 표시 */
  todayCredits: number
  /** 화면에 보일 아이 이름 */
  childName: string
  /** 닫기 버튼 / 완료 시 부모에 알림 */
  onClose: () => void
}

export default function AllMissionCompleteOverlay({
  todayCredits,
  childName,
  onClose,
}: Props) {
  useEffect(() => {
    // 화면이 뜨고 아주 잠시 후에 색종이를 쏴서, 레이아웃이 잡힌 뒤에 터지게 합니다
    const t1 = setTimeout(() => {
      // 왼쪽 아래 쪽에서 위로 쏘는 느낌
      confetti({
        particleCount: 80,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.75 },
        colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'],
        zIndex: 9999,
      })
      // 오른쪽 대칭
      confetti({
        particleCount: 80,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.75 },
        colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'],
        zIndex: 9999,
      })
    }, 100)

    // 잠시 뒤 가운데에서 한 번 더 크게
    const t2 = setTimeout(() => {
      confetti({
        particleCount: 150,
        spread: 120,
        origin: { x: 0.5, y: 0.4 },
        colors: ['#FFD700', '#FF69B4', '#7B68EE', '#00CED1', '#FF6347'],
        zIndex: 9999,
      })
    }, 300)

    // 1초 뒤 좌·우에서 한 번씩 가볍게
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
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="all-mission-complete-title"
    >
      <div
        className="bg-white rounded-3xl px-8 py-10 mx-6 text-center shadow-2xl w-full max-w-sm"
        style={{ animation: 'celebratePopIn 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}
      >
        {/* 병아리 이모지: 위아래로 통통(글로벌 키프레임 celebrateJump) */}
        <div
          className="text-6xl mb-2 inline-block"
          style={{ animation: 'celebrateJump 0.5s ease-in-out infinite alternate' }}
        >
          🐥
        </div>

        <div className="text-2xl mb-1">✨ 🎉 ✨</div>

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
            <span className="text-4xl" aria-hidden>🪙</span>
            <span
              className="text-5xl font-black"
              style={{ color: '#D4A000' }}
            >
              +{todayCredits}
            </span>
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-7">내일도 미션이 기다리고 있어요! 🌟</p>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-4 rounded-2xl font-black text-white text-lg
                     active:scale-95 transition-transform"
          style={{
            background: 'linear-gradient(135deg, #7C6CF8, #A78BFA)',
            boxShadow: '0 4px 20px rgba(124,108,248,0.4)',
          }}
        >
          좋아! 내일도 할게요 🚀
        </button>
      </div>
    </div>
  )
}
