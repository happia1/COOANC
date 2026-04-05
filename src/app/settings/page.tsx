'use client'

/**
 * 앱 설정 화면
 * - 프로필 이름 편집
 * - 로그아웃
 * - 알림 / 소리 토글 (localStorage)
 */
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { AUTH_LOGO_SRC } from '@/constants/branding'
import MissionSuggestCard from '@/components/settings/MissionSuggestCard'

export default function SettingsPage() {
  const router = useRouter()

  const [notifOn, setNotifOn] = useState(true)
  const [soundOn, setSoundOn] = useState(true)

  const [profileName, setProfileName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameSaving, setNameSaving] = useState(false)

  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    setNotifOn(localStorage.getItem('cooanc_notif') !== 'off')
    setSoundOn(localStorage.getItem('cooanc_sound') !== 'off')

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

  async function handleNameSave() {
    if (!profileName.trim()) return
    setNameSaving(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({ name: profileName.trim() }).eq('id', user.id)
      setUserName(profileName.trim())
    }
    setNameSaving(false)
    setEditingName(false)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-sky-100 via-white to-green-50">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-10 pt-6">
        <div className="mb-2 flex items-center gap-3">
          <button type="button" onClick={() => router.back()} className="text-sm font-bold text-[#4A90E2]">
            ← 뒤로
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Image src={AUTH_LOGO_SRC} alt="COOANC" width={72} height={72} className="rounded-lg" style={{ height: 'auto' }} />
            <span className="text-sm font-black text-[#4A90E2]">설정</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">프로필</p>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4A90E2]/20 to-[#7ED321]/20 text-2xl">
              {userRole === 'parent' ? '👩‍💼' : '🧒'}
            </div>
            <div className="min-w-0 flex-1">
              {editingName ? (
                <div className="flex gap-2">
                  <input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2]/40"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleNameSave}
                    disabled={nameSaving}
                    className="rounded-xl bg-[#4A90E2] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {nameSaving ? '저장 중' : '저장'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingName(false)
                      setProfileName(userName)
                    }}
                    className="rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-500"
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
                    type="button"
                    onClick={() => setEditingName(true)}
                    className="rounded-xl bg-[#4A90E2]/10 px-3 py-1.5 text-xs font-bold text-[#4A90E2]"
                  >
                    편집
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">알림 &amp; 소리</p>
          <ToggleRow label="푸시 알림" emoji="🔔" on={notifOn} onToggle={toggleNotif} />
          <ToggleRow label="효과음" emoji="🔊" on={soundOn} onToggle={toggleSound} />
        </div>

        <MissionSuggestCard />

        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-2xl border-2 border-red-200 bg-white py-4 text-sm font-bold text-red-500 shadow-sm transition-all active:scale-95"
        >
          🚪 로그아웃
        </button>
      </div>
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
        type="button"
        onClick={onToggle}
        className={`relative h-6 w-12 rounded-full transition-all ${on ? 'bg-[#4A90E2]' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-0.5'}`} />
      </button>
    </div>
  )
}
