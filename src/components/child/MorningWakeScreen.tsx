'use client'

/**
 * 기상 화면 — 수면 모드 이후 아침 인사 + 컨페티
 *
 * 비개발자 설명: 밝은 그라데이션과 해 이모지로 아침 분위기를 내고, 시작 버튼을 누를 때만
 * 「기분좋게 시작」 음이 나고(한 번), 버튼으로 홈으로 돌아갑니다. 팝업이 뜰 때는 소리를 내지 않습니다.
 */

import { useEffect } from 'react'
import { playAudio, CHILD_AUDIO } from '@/lib/childAudio'
import confetti from 'canvas-confetti'

interface Props {
  childName: string
  onStart: () => void
}

export default function MorningWakeScreen({ onStart }: Props) {
  // 화면이 열릴 때는 효과음 없이 컨페티만(기분좋게 시작 음은 아래 [시작] 버튼에서만 재생)
  useEffect(() => {
    const t = window.setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 80,
        origin: { x: 0.5, y: 0.3 },
        colors: ['#FFD700', '#FFB347', '#FFF', '#87CEEB', '#98D8C8'],
        zIndex: 9999,
      })
    }, 500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: 'linear-gradient(180deg, #FFE082 0%, #FFB347 40%, #FF8C69 100%)',
      }}
    >
      <div
        style={{
          animation: 'sunRise 1s ease-out',
          filter: 'drop-shadow(0 0 30px rgba(255,200,0,0.8))',
          marginBottom: 20,
        }}
      >
        {/* 좋은 아침 화면의 해 이미지는 고정 요청 경로의 morning.png 를 사용합니다. */}
        <img
          src="/assets/img/missions/routine/a.m/morning.png"
          alt="아침 해 이미지"
          className="h-[120px] w-[120px] select-none object-contain"
          draggable={false}
        />
      </div>

      <p
        style={{
          fontSize: 26,
          fontWeight: 900,
          color: 'white',
          textShadow: '0 2px 12px rgba(0,0,0,0.2)',
          marginBottom: 8,
        }}
      >
        좋은 아침이에요!
      </p>

      <button
        type="button"
        onClick={() => {
          playAudio(CHILD_AUDIO.goodMorning, 0.5)
          onStart()
        }}
        style={{
          padding: '16px 48px',
          borderRadius: 999,
          background: 'white',
          border: 'none',
          fontSize: 18,
          fontWeight: 900,
          color: '#FF8C00',
          boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
          cursor: 'pointer',
          animation: 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.3s both',
        }}
      >
        미션하러가기
      </button>
    </div>
  )
}
