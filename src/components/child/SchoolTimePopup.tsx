'use client'

/**
 * 등원 알람 팝업 — 부모가 지정한 시각에 자녀 화면에 표시
 *
 * 비개발자 설명: 학교·유치원 등 나가기 전, 가방 챙기고 출발하라는 알림이에요.
 *               화면이 뜨면서 「이제 나갈 시간」 안내 음원이 재생됩니다.
 */

import { useEffect } from 'react'
import { playAudio, CHILD_AUDIO } from '@/lib/childAudio'

interface Props {
  /** 자녀 이름 — 문구에 넣어 개인화 */
  childName: string
  /** 확인 버튼 — 팝업을 닫을 때 호출 */
  onClose: () => void
}

export default function SchoolTimePopup({ childName, onClose }: Props) {
  // 마운트 직후 한 번만 등원 안내 음원 재생
  useEffect(() => {
    playAudio(CHILD_AUDIO.timeToGo)
  }, [])

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

        <button
          type="button"
          onClick={onClose}
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
