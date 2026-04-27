'use client'

/**
 * 잘 준비 알림 팝업 — 부모가 지정한 시각에 자녀 화면에 표시
 *
 * 비개발자 설명: 취침 전에 미리 침대에 갈 준비를 하자는 알림이에요. 소리가 나고 미션으로 이어갈 수 있어요.
 *               실제 재생 주소는 부모(ChildScreen)가 `soundSrc` 로 넘깁니다.
 */

import { useEffect } from 'react'
import { playAudio, CHILD_AUDIO } from '@/lib/childAudio'

interface Props {
  childName: string
  /** 부모 설정에서 풀어온 재생 URL(없으면 기본 잘 준비 음원) */
  soundSrc?: string
  /** 미션 영역으로 돌아가기(닫기) */
  onGoMission: () => void
  onClose: () => void
}

export default function SleepReadyPopup({ childName, soundSrc, onGoMission, onClose }: Props) {
  useEffect(() => {
    playAudio(soundSrc ?? CHILD_AUDIO.sleepReady)
  }, [soundSrc])

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

        <button
          type="button"
          onClick={onGoMission}
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
          onClick={onClose}
          className="w-full py-3 rounded-2xl font-medium text-gray-400 text-sm bg-gray-50 active:bg-gray-100"
        >
          나중에 할게요
        </button>
      </div>
    </div>
  )
}
