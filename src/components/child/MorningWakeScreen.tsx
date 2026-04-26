'use client'

/**
 * 기상 화면 — 수면 모드 이후 아침 인사 + 컨페티
 *
 * 비개발자 설명: 밝은 그라데이션과 해 이모지로 아침 분위기를 내고, 시작 버튼으로 홈으로 돌아갑니다.
 */

import { useEffect } from 'react'
import { playAudio, CHILD_AUDIO } from '@/lib/childAudio'
import confetti from 'canvas-confetti'

interface Props {
  childName: string
  onStart: () => void
}

export default function MorningWakeScreen({ childName, onStart }: Props) {
  useEffect(() => {
    playAudio(CHILD_AUDIO.goodMorning)

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
          fontSize: 100,
          animation: 'sunRise 1s ease-out',
          filter: 'drop-shadow(0 0 30px rgba(255,200,0,0.8))',
          marginBottom: 20,
        }}
      >
        ☀️
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
        좋은 아침이에요! 🌸
      </p>
      <p
        style={{
          fontSize: 18,
          color: 'rgba(255,255,255,0.9)',
          marginBottom: 48,
        }}
      >
        오늘도 멋진 하루 시작해봐요, {childName}!
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
        좋아! 오늘 하루도 시작해볼까? 🌟
      </button>
    </div>
  )
}
