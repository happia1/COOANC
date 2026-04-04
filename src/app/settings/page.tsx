'use client'

/**
 * 앱 설정 화면
 * - 현재 디바이스 모드 표시
 * - PIN 인증 후 모드 변경 가능
 * - 프로필 이름 편집
 * - 로그아웃
 * - 알림 / 소리 토글 (localStorage)
 */
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { AUTH_LOGO_SRC } from '@/constants/branding'
import type { DeviceMode } from '@/store/deviceStore'

const MODE_LABEL: Record<DeviceMode, string> = {
  shared: '공유 디바이스',
  child: '자녀 전용',
  parent: '부모 전용',
}
const MODE_EMOJI: Record<DeviceMode, string> = {
  shared: '👨‍👩‍👧‍👦',
  child: '🧒',
  parent: '👩‍💼',
}
const NEW_MODES: { value: DeviceMode; emoji: string; label: string }[] = [
  { value: 'shared', emoji: '👨‍👩‍👧‍👦', label: '공유 디바이스' },
  { value: 'child',  emoji: '🧒',       label: '자녀 전용' },
  { value: 'parent', emoji: '👩‍💼',      label: '부모 전용' },
]

type ModalStep = 'pin' | 'mode' | null

export default function SettingsPage() {
  const router = useRouter()

  // 디바이스 모드 (localStorage)
  const [deviceMode, setDeviceMode] = useState<DeviceMode | null>(null)
  // 알림 / 소리 토글 (localStorage)
  const [notifOn, setNotifOn] = useState(true)
  const [soundOn, setSoundOn] = useState(true)

  // 프로필 편집
  const [profileName, setProfileName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameSaving, setNameSaving] = useState(false)

  // PIN 모달
  const [modalStep, setModalStep] = useState<ModalStep>(null)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')

  // 사용자 정보
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('cooanc_device_mode') as DeviceMode | null
    setDeviceMode(raw)
    setNotifOn(localStorage.getItem('cooanc_notif') !== 'off')
    setSoundOn(localStorage.getItem('cooanc_sound') !== 'off')

    // 사용자 정보 조회
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('name, role').eq('id', user.id).maybeSingle()
      if (data) {
        setUserName(data.name ?? '')
        setProfileName(data.name ?? '')
        setUserRole(data.role ?? null)
      }
    })
  }, [])

  // 토글 저장
  function toggleNotif() {
    const next = !notifOn
    setNotifOn(next)
    localStorage.setItem('cooanc_notif', next ? 'on' : 'off')
  }
  function toggleSound() {
    const next = !soundOn
    setSoundOn(next)
    localStorage.setItem('cooanc_sound', next ? 'on' : 'off')
  }

  // PIN 키패드 입력
  function handlePinKey(digit: string) {
    setPinError('')
    if (pinInput.length < 4) setPinInput((p) => p + digit)
  }
  function handlePinBack() {
    setPinError('')
    setPinInput((p) => p.slice(0, -1))
  }

  // PIN 확인 → 모드 선택 화면으로
  function handlePinConfirm() {
    const saved = localStorage.getItem('cooanc_device_pin') ?? ''
    if (pinInput !== saved) {
      setPinError('PIN이 올바르지 않아요.')
      setPinInput('')
      return
    }
    setPinInput('')
    setModalStep('mode')
  }

  // 모드 변경 완료
  function handleModeChange(mode: DeviceMode) {
    localStorage.setItem('cooanc_device_mode', mode)
    setDeviceMode(mode)
    setModalStep(null)
  }

  // 프로필 이름 저장
  async function handleNameSave() {
    if (!profileName.trim()) return
    setNameSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({ name: profileName.trim() }).eq('id', user.id)
      setUserName(profileName.trim())
    }
    setNameSaving(false)
    setEditingName(false)
  }

  // 로그아웃
  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-green-50 flex flex-col">
      <div className="w-full max-w-md mx-auto px-4 pt-6 pb-10 flex flex-col gap-4">

        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => router.back()} className="text-[#4A90E2] font-bold text-sm">
            ← 뒤로
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <Image src={AUTH_LOGO_SRC} alt="COOANC" width={24} height={24} className="rounded-lg" style={{ height: 'auto' }} />
            <span className="text-sm font-black text-[#4A90E2]">설정</span>
          </div>
        </div>

        {/* 프로필 카드 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">프로필</p>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#4A90E2]/20 to-[#7ED321]/20 flex items-center justify-center text-2xl">
              {userRole === 'parent' ? '👩‍💼' : '🧒'}
            </div>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex gap-2">
                  <input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2]/40"
                    autoFocus
                  />
                  <button
                    onClick={handleNameSave}
                    disabled={nameSaving}
                    className="px-3 py-1.5 bg-[#4A90E2] text-white text-xs font-bold rounded-xl disabled:opacity-50"
                  >
                    {nameSaving ? '저장 중' : '저장'}
                  </button>
                  <button
                    onClick={() => { setEditingName(false); setProfileName(userName) }}
                    className="px-3 py-1.5 bg-gray-100 text-gray-500 text-xs font-bold rounded-xl"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-800">{userName || '(이름 없음)'}</p>
                    <p className="text-[11px] text-gray-400">{userRole === 'parent' ? '부모' : '자녀'} 계정</p>
                  </div>
                  <button
                    onClick={() => setEditingName(true)}
                    className="text-xs text-[#4A90E2] font-bold px-3 py-1.5 bg-[#4A90E2]/10 rounded-xl"
                  >
                    편집
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 디바이스 모드 카드 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">디바이스 모드</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{deviceMode ? MODE_EMOJI[deviceMode] : '❓'}</span>
              <div>
                <p className="font-bold text-gray-800">{deviceMode ? MODE_LABEL[deviceMode] : '설정 필요'}</p>
                <p className="text-[11px] text-gray-400">PIN 인증 후 변경 가능</p>
              </div>
            </div>
            <button
              onClick={() => { setPinInput(''); setPinError(''); setModalStep('pin') }}
              className="text-xs text-[#4A90E2] font-bold px-3 py-1.5 bg-[#4A90E2]/10 rounded-xl"
            >
              변경
            </button>
          </div>
        </div>

        {/* 알림 / 소리 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">알림 &amp; 소리</p>
          <ToggleRow label="푸시 알림" emoji="🔔" on={notifOn} onToggle={toggleNotif} />
          <ToggleRow label="효과음" emoji="🔊" on={soundOn} onToggle={toggleSound} />
        </div>

        {/* 로그아웃 */}
        <button
          onClick={handleLogout}
          className="w-full py-4 rounded-2xl bg-white border-2 border-red-200 text-red-500 font-bold text-sm shadow-sm active:scale-95 transition-all"
        >
          🚪 로그아웃
        </button>

      </div>

      {/* PIN 모달 */}
      {modalStep && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
          <div className="w-full max-w-md bg-white rounded-t-3xl px-6 pt-6 pb-10 flex flex-col items-center gap-5">

            {modalStep === 'pin' && (
              <>
                <div className="w-10 h-1 bg-gray-200 rounded-full mb-2" />
                <p className="text-lg font-black text-gray-800">PIN 입력</p>
                <p className="text-sm text-gray-400 -mt-3">모드 변경을 위해 PIN을 입력해 주세요</p>

                {/* 도트 */}
                <div className="flex gap-4">
                  {[0,1,2,3].map((i) => (
                    <div key={i} className={`w-5 h-5 rounded-full border-2 transition-all ${i < pinInput.length ? 'bg-[#4A90E2] border-[#4A90E2]' : 'bg-white border-gray-300'}`} />
                  ))}
                </div>

                {pinError && <p className="text-xs text-red-500">{pinError}</p>}

                {/* 키패드 */}
                <div className="grid grid-cols-3 gap-3 w-full">
                  {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => {
                    if (k === '') return <div key={i} />
                    const isBack = k === '⌫'
                    return (
                      <button key={i} onClick={() => isBack ? handlePinBack() : handlePinKey(k)}
                        className={`h-14 rounded-2xl text-xl font-bold transition-all active:scale-90 ${isBack ? 'bg-gray-100 text-gray-500' : 'bg-gray-50 text-gray-800'}`}>
                        {k}
                      </button>
                    )
                  })}
                </div>

                <div className="flex gap-3 w-full">
                  <button onClick={() => setModalStep(null)} className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-500 font-bold">취소</button>
                  <button onClick={handlePinConfirm} disabled={pinInput.length < 4}
                    className="flex-1 py-3 rounded-2xl bg-[#4A90E2] text-white font-bold disabled:opacity-40">확인</button>
                </div>
              </>
            )}

            {modalStep === 'mode' && (
              <>
                <div className="w-10 h-1 bg-gray-200 rounded-full mb-2" />
                <p className="text-lg font-black text-gray-800">모드 변경</p>
                <p className="text-sm text-gray-400 -mt-3">새로운 디바이스 모드를 선택해 주세요</p>

                <div className="w-full flex flex-col gap-3">
                  {NEW_MODES.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => handleModeChange(m.value)}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all active:scale-95 ${
                        m.value === deviceMode
                          ? 'bg-[#4A90E2]/10 border-[#4A90E2]'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <span className="text-3xl">{m.emoji}</span>
                      <div>
                        <p className={`font-bold ${m.value === deviceMode ? 'text-[#4A90E2]' : 'text-gray-700'}`}>{m.label}</p>
                        {m.value === deviceMode && <p className="text-xs text-[#4A90E2]">현재 모드</p>}
                      </div>
                    </button>
                  ))}
                </div>

                <button onClick={() => setModalStep(null)} className="w-full py-3 rounded-2xl bg-gray-100 text-gray-500 font-bold">취소</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ToggleRow({ label, emoji, on, onToggle }: { label: string; emoji: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-xl">{emoji}</span>
        <span className="text-sm font-bold text-gray-700">{label}</span>
      </div>
      <button
        onClick={onToggle}
        className={`w-12 h-6 rounded-full transition-all relative ${on ? 'bg-[#4A90E2]' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-0.5'}`} />
      </button>
    </div>
  )
}
