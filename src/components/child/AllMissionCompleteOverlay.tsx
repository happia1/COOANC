'use client'

/**
 * AllMissionCompleteOverlay — 오늘 미션을 모두 완료했을 때 뜨는 축하 전체 화면
 *
 * 비개발자 설명:
 * - 반투명 배경 위에 「미션 완료!」 제목과, 가운데 큰 축하 캐릭터 그림만 보여 줍니다.
 * - 화면이 켜질 때는 소리 없이 색종이(컨페티)만 터집니다.
 * - [내일 만나자! 잘자~]를 누르면 잘 준비 음 없이 수면 모드로 넘어갑니다(onSleep).
 */

import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'

interface Props {
  /** 수면 모드(잘자 화면)로 전환 */
  onSleep: () => void
}

export default function AllMissionCompleteOverlay({ onSleep }: Props) {
  /** 블러 배경 뒤로 가리지 않게, 팝업 카드 내부 캔버스에서 컨페티를 렌더링합니다. */
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = confettiCanvasRef.current
    if (!canvas) return
    const fire = confetti.create(canvas, { resize: true, useWorker: true })

    // 화면이 뜨고 아주 잠시 후에 색종이를 쏴서, 레이아웃이 잡힌 뒤에 터지게 합니다 (팝업 오픈 시 음성 없음)
    const t1 = setTimeout(() => {
      fire({
        particleCount: 80,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.75 },
        colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'],
      })
      fire({
        particleCount: 80,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.75 },
        colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'],
      })
    }, 100)

    const t2 = setTimeout(() => {
      fire({
        particleCount: 150,
        spread: 120,
        origin: { x: 0.5, y: 0.4 },
        colors: ['#FFD700', '#FF69B4', '#7B68EE', '#00CED1', '#FF6347'],
      })
    }, 300)

    const t3 = setTimeout(() => {
      fire({
        particleCount: 60,
        spread: 80,
        origin: { x: 0.3, y: 0.5 },
        colors: ['#FFD700', '#FF6B6B'],
      })
      fire({
        particleCount: 60,
        spread: 80,
        origin: { x: 0.7, y: 0.5 },
        colors: ['#4ECDC4', '#45B7D1'],
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
      {/* 흰 카드 안에서는 제목 위·버튼 아래만 두고, 가운데는 캐릭터 이미지가 영역을 꽉 채웁니다. */}
      {/* 카드 높이는 예전(max 90vh·640px)의 절반으로 — 작은 화면에서 덜 차지하게 합니다. */}
      {/* 캐릭터를 2배로 키우면 세로가 부족할 수 있어 카드 높이도 넉넉히 둡니다. */}
      <div
        className="relative mx-6 flex h-[min(88vh,620px)] w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-white py-5 text-center shadow-2xl"
        style={{ animation: 'celebratePopIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      >
        {/* 팝업 카드 바로 뒤에서 컨페티가 터지도록 카드 내부 전용 캔버스 레이어를 둡니다. */}
        <canvas ref={confettiCanvasRef} className="pointer-events-none absolute inset-0 z-0 h-full w-full" aria-hidden />

        <p id="all-mission-complete-title" className="relative z-10 shrink-0 px-6 text-2xl font-black text-gray-800">
          미션 완료!
        </p>

        {/*
         * `next/image` + flex(`min-h-0`) 조합에서 중앙 영역 높이가 0으로 잡혀 그림이 안 보이는 경우가 있어,
         * 이 팝업만 일반 img 로 고정합니다. 비개발자: 축하 그림이 항상 중앙에 보이게 하려는 처리입니다.
         */}
        {/* z-[21]: 컨페티용 캔버스보다 반드시 위에 두어 축하 캐릭터가 안 가려지게 합니다. */}
        <div className="relative z-[21] mt-3 flex min-h-[min(42vh,360px)] w-full flex-1 items-center justify-center px-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/img/characters/onboarding/congrats.png"
            alt="미션 완료 축하 캐릭터"
            width={336}
            height={336}
            className="relative z-[1] block h-auto w-[304px] max-w-[92%] shrink-0 select-none object-contain"
            draggable={false}
            loading="eager"
            decoding="async"
          />
        </div>

        <div className="relative z-10 shrink-0 px-6 pt-3">
          <button
            type="button"
            onClick={() => {
              onSleep()
            }}
            className="w-full rounded-2xl py-4 text-lg font-black text-white transition-transform active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #7C6CF8, #A78BFA)',
              boxShadow: '0 4px 20px rgba(124,108,248,0.4)',
            }}
          >
            내일 만나자! 잘자~ 🌙
          </button>
        </div>
      </div>
    </div>
  )
}
