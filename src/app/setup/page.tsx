'use client'

/**
 * 디바이스 모드 설정 화면
 * Step 1: 모드 선택 (공유 / 자녀 전용 / 부모 전용)
 * Step 2: PIN 4자리 입력 (숫자 키패드)
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AUTH_LOGO_SRC } from '@/constants/branding'
import type { DeviceMode } from '@/store/deviceStore'

const MODES: { value: DeviceMode; emoji: string; title: string; desc: string; color: string; bg: string }[] = [
  {
    value: 'shared',
    emoji: '👨‍👩‍👧‍👦',
    title: '공유 디바이스',
    desc: '부모와 자녀가 함께 사용해요.\n로그인 후 역할에 맞게 자동 분기돼요.',
    color: 'text-[#4A90E2]',
    bg: 'bg-[#4A90E2]/10 border-[#4A90E2]',
  },
  {
    value: 'child',
    emoji: '🧒',
    title: '자녀 전용',
    desc: '이 기기는 자녀만 사용해요.\n항상 자녀 앱으로 연결돼요.',
    color: 'text-[#7ED321]',
    bg: 'bg-[#7ED321]/10 border-[#7ED321]',
  },
  {
    value: 'parent',
    emoji: '👩‍💼',
    title: '부모 전용',
    desc: '이 기기는 부모만 사용해요.\n항상 부모 앱으로 연결돼요.',
    color: 'text-[#F5A623]',
    bg: 'bg-[#F5A623]/10 border-[#F5A623]',
  },
]

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<'mode' | 'pin' | 'confirm'>('mode')
  const [selectedMode, setSelectedMode] = useState<DeviceMode | null>(null)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')

  // 모드 선택 완료
  function handleModeSelect(mode: DeviceMode) {
    setSelectedMode(mode)
    setStep('pin')
  }

  // PIN 숫자 입력 (step: pin or confirm)
  function handleKey(digit: string) {
    setError('')
    if (step === 'pin') {
      if (pin.length < 4) setPin((p) => p + digit)
    } else {
      if (confirmPin.length < 4) setConfirmPin((p) => p + digit)
    }
  }

  // 백스페이스
  function handleBack() {
    setError('')
    if (step === 'pin') {
      setPin((p) => p.slice(0, -1))
    } else {
      setConfirmPin((p) => p.slice(0, -1))
    }
  }

  // PIN 입력 완료 처리
  function handlePinDone() {
    if (pin.length < 4) return
    setStep('confirm')
  }

  // 확인 PIN 완료 처리
  function handleConfirmDone() {
    if (confirmPin.length < 4) return
    if (pin !== confirmPin) {
      setError('PIN이 일치하지 않아요. 다시 시도해 주세요.')
      setConfirmPin('')
      return
    }
    // 저장
    localStorage.setItem('cooanc_device_mode', selectedMode!)
    localStorage.setItem('cooanc_device_pin', pin)
    router.replace('/')
  }

  const currentPin = step === 'pin' ? pin : confirmPin
  const isDone = step === 'pin' ? pin.length === 4 : confirmPin.length === 4

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-green-50 flex flex-col items-center px-6 py-10">

      {/* 로고 */}
      <div className="flex items-center gap-2 mb-8">
        <Image src={AUTH_LOGO_SRC} alt="COOANC" width={36} height={36} className="rounded-xl" style={{ height: 'auto' }} />
        <span className="text-xl font-black text-[#4A90E2]">COOANC</span>
      </div>

      {step === 'mode' && (
        <div className="w-full max-w-sm flex flex-col gap-4">
          <div className="text-center mb-2">
            <p className="text-xl font-black text-gray-800">디바이스 모드 설정</p>
            <p className="text-sm text-gray-400 mt-1">이 기기의 사용 방식을 선택해 주세요</p>
          </div>

          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => handleModeSelect(m.value)}
              className={`w-full flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all active:scale-95 ${m.bg}`}
            >
              <span className="text-4xl flex-shrink-0 mt-0.5">{m.emoji}</span>
              <div>
                <p className={`text-base font-black ${m.color}`}>{m.title}</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed whitespace-pre-line">{m.desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {(step === 'pin' || step === 'confirm') && (
        <div className="w-full max-w-xs flex flex-col items-center gap-6">
          {/* 뒤로가기 */}
          <button
            onClick={() => { step === 'confirm' ? (setStep('pin'), setConfirmPin(''), setError('')) : setStep('mode') }}
            className="self-start text-sm text-[#4A90E2] font-bold"
          >
            ← 뒤로
          </button>

          <div className="text-center">
            <p className="text-xl font-black text-gray-800">
              {step === 'pin' ? 'PIN 설정' : 'PIN 확인'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {step === 'pin'
                ? '설정 변경 시 사용할 PIN 4자리를 입력해 주세요'
                : 'PIN을 한 번 더 입력해 주세요'}
            </p>
          </div>

          {/* PIN 도트 표시 */}
          <div className="flex gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-5 h-5 rounded-full border-2 transition-all ${
                  i < currentPin.length
                    ? 'bg-[#4A90E2] border-[#4A90E2]'
                    : 'bg-white border-gray-300'
                }`}
              />
            ))}
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded-xl px-4 py-2 text-center">{error}</p>
          )}

          {/* 숫자 키패드 */}
          <div className="grid grid-cols-3 gap-3 w-full">
            {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => {
              if (k === '') return <div key={i} />
              const isBackspace = k === '⌫'
              return (
                <button
                  key={i}
                  onClick={() => isBackspace ? handleBack() : handleKey(k)}
                  className={`h-16 rounded-2xl text-xl font-bold transition-all active:scale-90 ${
                    isBackspace
                      ? 'bg-gray-100 text-gray-500'
                      : 'bg-white shadow-sm text-gray-800 border border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  {k}
                </button>
              )
            })}
          </div>

          {/* 확인 버튼 */}
          <button
            disabled={!isDone}
            onClick={step === 'pin' ? handlePinDone : handleConfirmDone}
            className="w-full py-4 rounded-2xl bg-[#4A90E2] text-white font-black text-base shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            {step === 'pin' ? '다음' : '완료'}
          </button>
        </div>
      )}
    </div>
  )
}
