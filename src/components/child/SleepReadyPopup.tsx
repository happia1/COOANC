'use client'

/**
 * 잘 준비 알림 팝업 — 부모가 지정한 시각에 자녀 화면에 표시
 *
 * 비개발자 설명: 취침 전에 미리 침대에 갈 준비를 하자는 알림이에요. 소리가 나고 미션으로 이어갈 수 있어요.
 *               실제 재생 주소는 부모(ChildScreen)가 `soundSrc` 로 넘깁니다.
 */

import { useEffect, useRef, useState } from 'react'
import { CHILD_AUDIO } from '@/lib/childAudio'

interface Props {
  childName: string
  /** 부모 설정에서 풀어온 재생 URL(없으면 기본 잘 준비 음원) */
  soundSrc?: string
  /** 미션 영역으로 돌아가기(닫기) */
  onGoMission: () => void
  onClose: () => void
}

export default function SleepReadyPopup({ childName, soundSrc, onGoMission, onClose }: Props) {
  const soundRef = useRef<HTMLAudioElement | null>(null)
  const [needsTapForSound, setNeedsTapForSound] = useState(false)

  useEffect(() => {
    let cancelled = false
    const url = soundSrc ?? CHILD_AUDIO.sleepReady

    const audio = new Audio(url)
    audio.volume = 1
    soundRef.current = audio

    void audio.play().catch(() => {
      if (!cancelled) setNeedsTapForSound(true)
    })

    return () => {
      cancelled = true
      audio.pause()
      audio.currentTime = 0
      soundRef.current = null
    }
  }, [soundSrc])

  async function playAlarmFromGesture() {
    const url = soundSrc ?? CHILD_AUDIO.sleepReady
    const prev = soundRef.current
    if (prev) {
      prev.pause()
      prev.currentTime = 0
    }
    const audio = new Audio(url)
    audio.volume = 1
    soundRef.current = audio
    try {
      await audio.play()
      setNeedsTapForSound(false)
    } catch {
      setNeedsTapForSound(true)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center"
      style={{ background: 'rgba(10,20,50,0.7)', backdropFilter: 'blur(8px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sleep-ready-title"
    >
      <div
        className="bg-white rounded-3xl px-8 py-10 mx-6 text-center shadow-2xl w-full max-w-sm"
        style={{ animation: 'celebratePopIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      >
        <div
          className="text-6xl mb-4 inline-block"
          style={{ animation: 'moonFloat 3s ease-in-out infinite' }}
        >
          🌙
        </div>

        <p id="sleep-ready-title" className="text-2xl font-black text-gray-800 mb-2">
          잘 준비 할 시간!
        </p>
        <p className="text-sm text-gray-400 mb-8 leading-relaxed">
          {childName}야, 이제 슬슬
          <br />
          잠 잘 준비를 해볼까요? 😊
        </p>

        {needsTapForSound ? (
          <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2 text-[11px] font-bold leading-snug text-violet-950">
            소리가 안 들렸나요? 브라우저가 알람 재생을 막았을 수 있어요. 아래를 눌러 주세요.
            <button
              type="button"
              className="mt-2 w-full rounded-xl bg-violet-600 py-2.5 text-xs font-black text-white"
              onClick={() => void playAlarmFromGesture()}
            >
              알람 소리 듣기
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => {
            const el = soundRef.current
            if (el) {
              el.pause()
              el.currentTime = 0
              soundRef.current = null
            }
            onGoMission()
          }}
          className="w-full py-4 rounded-2xl font-black text-white text-base mb-3
                     active:scale-95 transition-transform"
          style={{
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            boxShadow: '0 4px 20px rgba(102,126,234,0.4)',
          }}
        >
          미션 하러가기 ✨
        </button>

        <button
          type="button"
          onClick={() => {
            const el = soundRef.current
            if (el) {
              el.pause()
              el.currentTime = 0
              soundRef.current = null
            }
            onClose()
          }}
          className="w-full py-3 rounded-2xl font-medium text-gray-400 text-sm bg-gray-50 active:bg-gray-100"
        >
          나중에 할게요
        </button>
      </div>
    </div>
  )
}
