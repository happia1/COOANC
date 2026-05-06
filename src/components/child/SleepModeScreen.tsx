'use client'

/**
 * 수면 모드 전체 화면 — 미션 완료 후 "잘자" 흐름에서 표시
 *
 * 비개발자 설명: 어두운 밤하늘·달·시계를 보여 주고, 설정한 기상 시각이 되면 아침 인사 소리 후 깨어납니다.
 * 알람이 없으면(null) 화면을 탭해서 바로 깰 수 있습니다.
 */

import { useEffect, useRef, useState } from 'react'
import { CHILD_AUDIO, tryPlayAudioOnce } from '@/lib/childAudio'
import { getSeoulDateString, getSeoulTimeHHMM } from '@/lib/koreaDate'

/** 별 하나의 위치·애니메이션 값 — 클라이언트 마운트 후 한 번만 생성(SSR/하이드레이션 불일치 방지) */
type StarSpec = {
  leftPct: number
  topPct: number
  size: number
  opacity: number
  durationSec: number
  delaySec: number
}

interface Props {
  childName: string
  /** "07:00" 형식 — 루틴 기상 알람(localStorage). 없으면 자동 알람 없음 */
  alarmTime: string | null
  onWake: () => void
}

export default function SleepModeScreen({ childName, alarmTime, onWake }: Props) {
  const [currentTime, setCurrentTime] = useState('')
  const [stars, setStars] = useState<StarSpec[]>([])
  /** 같은 분에 아침 알람이 여러 번 울리지 않도록 */
  const alarmFiredForMinuteRef = useRef<string | null>(null)

  // 별 패턴: 마운트 후에만 무작위 생성
  useEffect(() => {
    setStars(
      Array.from({ length: 20 }, () => ({
        leftPct: Math.random() * 100,
        topPct: Math.random() * 60,
        size: Math.random() * 3 + 1,
        opacity: Math.random() * 0.7 + 0.3,
        durationSec: Math.random() * 2 + 1,
        delaySec: Math.random() * 2,
      })),
    )
  }, [])

  useEffect(() => {
    const tick = () => {
      const hm = getSeoulTimeHHMM()
      setCurrentTime(hm)
      /** 서울 달력 날짜 + 시각 기준으로 하루에 한 번만 아침 인사 재생 시도 — 기기 시간대와 무관 */
      const todaySeoul = getSeoulDateString()

      if (alarmTime && hm === alarmTime) {
        const key = `${todaySeoul}-${hm}`
        if (alarmFiredForMinuteRef.current !== key) {
          alarmFiredForMinuteRef.current = key
          void tryPlayAudioOnce(CHILD_AUDIO.morningGreet, 1)
          window.setTimeout(() => onWake(), 1500)
        }
      }
    }
    tick()
    const interval = window.setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [alarmTime, onWake])

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: 'linear-gradient(180deg, #0D1B2A 0%, #1B2F4E 40%, #2D4A7A 100%)',
      }}
      role="presentation"
      onClick={onWake}
    >
      {stars.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${s.leftPct}%`,
            top: `${s.topPct}%`,
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            background: 'white',
            opacity: s.opacity,
            animation: `starTwinkle ${s.durationSec}s ease-in-out infinite alternate`,
            animationDelay: `${s.delaySec}s`,
          }}
        />
      ))}

      <div
        style={{
          animation: 'moonFloat 4s ease-in-out infinite',
          filter: 'drop-shadow(0 0 30px rgba(255,230,100,0.6))',
          marginBottom: 24,
        }}
      >
        {/* 수면 모드의 달 이미지는 고정 요청 경로의 night.png 를 사용합니다. */}
        <img
          src="/assets/img/missions/routine/p.m/night.png"
          alt="밤 달 이미지"
          className="h-[140px] w-[140px] select-none object-contain"
          draggable={false}
        />
      </div>

      <p
        style={{
          fontSize: 28,
          fontWeight: 900,
          color: 'white',
          textShadow: '0 2px 12px rgba(0,0,0,0.5)',
          marginBottom: 8,
        }}
      >
        잘 자요, {childName}! 💤
      </p>

      {alarmTime ? (
        <p
          style={{
            fontSize: 15,
            color: 'rgba(200,220,255,0.8)',
            marginBottom: 32,
          }}
        >
          내일 {alarmTime}에 만나요 ⏰
        </p>
      ) : null}

      <p
        style={{
          fontSize: 48,
          fontWeight: 300,
          color: 'rgba(200,220,255,0.9)',
          letterSpacing: 4,
          marginBottom: 48,
        }}
      >
        {currentTime}
      </p>

      <p
        style={{
          fontSize: 13,
          color: 'rgba(150,180,255,0.5)',
          animation: 'shimmer 2s ease-in-out infinite',
        }}
      >
        화면을 탭하면 깨어나요
      </p>
    </div>
  )
}
