'use client'

/**
 * 등원 알람 팝업 — 부모가 지정한 시각에 자녀 화면에 표시
 *
 * 비개발자 설명: 학교·유치원 등 나가기 전, 가방 챙기고 출발하라는 알림이에요.
 *               실제 재생 주소는 부모(ChildScreen)가 `soundSrc` 로 넘깁니다.
 */

import { useEffect, useRef, useState } from 'react'
import { CHILD_AUDIO } from '@/lib/childAudio'

interface Props {
  /** 자녀 이름 — 문구에 넣어 개인화 */
  childName: string
  /** 부모 설정에서 풀어온 재생 URL(없으면 기본 나갈 시간 안내) */
  soundSrc?: string
  /** 확인 버튼 — 팝업을 닫을 때 호출 */
  onClose: () => void
}

export default function SchoolTimePopup({ childName, soundSrc, onClose }: Props) {
  const soundRef = useRef<HTMLAudioElement | null>(null)
  const [needsTapForSound, setNeedsTapForSound] = useState(false)

  useEffect(() => {
    let cancelled = false
    const url = soundSrc ?? CHILD_AUDIO.timeToGo

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

  /** 버튼 누름 = 사용자 제스처 → 많은 브라우저에서 이때부터 소리 허용 */
  async function playAlarmFromGesture() {
    const url = soundSrc ?? CHILD_AUDIO.timeToGo
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
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(30,100,50,0.7)', backdropFilter: 'blur(8px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="school-time-title"
    >
      <div
        className="bg-white rounded-3xl px-8 py-10 mx-6 text-center shadow-2xl w-full max-w-sm"
        style={{ animation: 'celebratePopIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      >
        <div className="text-6xl mb-4 inline-block" aria-hidden>
          🎒
        </div>

        <p id="school-time-title" className="text-2xl font-black text-gray-800 mb-2">
          이제 나갈 시간이에요!
        </p>
        <p className="text-sm text-gray-400 mb-8 leading-relaxed">
          {childName}야, 가방 챙기고
          <br />
          출발할 준비 됐나요? 😊
        </p>

        {needsTapForSound ? (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold leading-snug text-emerald-900">
            소리가 안 들렸나요? 기기 브라우저가 알람 재생을 막았을 수 있어요. 아래를 눌러 주세요.
            <button
              type="button"
              className="mt-2 w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-black text-white"
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
            onClose()
          }}
          className="w-full py-4 rounded-2xl font-black text-white text-base active:scale-95 transition-transform"
          style={{
            background: 'linear-gradient(135deg, #11998e, #38ef7d)',
            boxShadow: '0 4px 20px rgba(17,153,142,0.4)',
          }}
        >
          출발! 🚗
        </button>
      </div>
    </div>
  )
}
