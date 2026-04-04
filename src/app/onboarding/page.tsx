'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { parseJsonFromResponse } from '@/lib/parseJsonResponse'

const AGE_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11]

export default function OnboardingPage() {
  const [childName, setChildName] = useState('')
  const [childAge, setChildAge]   = useState<number | null>(null)
  const [pin, setPin]             = useState('')
  const [error, setError]         = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!childAge) { setError('자녀의 나이를 선택해 주세요.'); return }
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError('PIN은 숫자 4자리로 입력해 주세요.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    // 현재 로그인한 부모 세션 확인
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      setError('로그인 세션이 만료됐어요. 다시 로그인해 주세요.')
      setLoading(false)
      return
    }

    const res = await fetch('/api/child/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: childName, age: childAge, pin, parentId: user.id }),
    })

    const { data: json, parseError } = await parseJsonFromResponse<{
      error?: string
      childId?: string
      name?: string
    }>(res)
    const payload = json ?? {}
    if (parseError) {
      setError('서버 응답을 읽을 수 없어요. 잠시 후 다시 시도해 주세요.')
      setLoading(false)
      return
    }

    if (!res.ok) {
      const errMsg =
        typeof payload.error === 'string' ? payload.error : '자녀 등록에 실패했어요. 다시 시도해 주세요.'
      setError(errMsg)
      setLoading(false)
      return
    }

    // 등록 성공 → 부모 홈으로
    window.location.href = '/parent'
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-green-50 flex flex-col items-center justify-center px-6 py-10">

      {/* 헤더 */}
      <div className="flex flex-col items-center gap-3 mb-7">
        <Image src="/COOANC_Logo.png" alt="COOANC" width={60} height={60} className="rounded-2xl" style={{ height: 'auto' }} />
        <div className="text-center">
          <h1 className="text-xl font-black text-brand-blue">첫 번째 자녀를 등록해요</h1>
          <p className="text-sm text-gray-400 mt-1">자녀 프로필을 만들면 미션을 시작할 수 있어요</p>
        </div>
      </div>

      <form
        onSubmit={handleCreate}
        className="w-full max-w-sm bg-white rounded-3xl shadow-lg p-7 flex flex-col gap-5"
      >
        {/* 자녀 이름 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-500" htmlFor="childName">
            자녀 이름 (닉네임)
          </label>
          <input
            id="childName"
            type="text"
            required
            value={childName}
            onChange={e => setChildName(e.target.value)}
            placeholder="예: 민준이, 서연이"
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-brand-text placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition"
          />
        </div>

        {/* 나이 선택 */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-gray-500">자녀 나이</span>
          <div className="grid grid-cols-4 gap-2">
            {AGE_OPTIONS.map(age => (
              <button
                key={age}
                type="button"
                onClick={() => setChildAge(age)}
                className={[
                  'py-2.5 rounded-xl border-2 text-sm font-bold transition-all',
                  childAge === age
                    ? 'border-brand-blue bg-brand-blue text-white scale-[1.04]'
                    : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200',
                ].join(' ')}
              >
                {age}세
              </button>
            ))}
          </div>
        </div>

        {/* PIN */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-500" htmlFor="pin">
            자녀 PIN <span className="font-normal text-gray-400">(4자리 숫자)</span>
          </label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            maxLength={4}
            required
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-brand-text placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition tracking-[0.5em] text-center"
          />
          <p className="text-[11px] text-gray-400">자녀가 앱에 접속할 때 사용하는 비밀번호예요</p>
        </div>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-green hover:bg-green-500 active:scale-95 text-white font-bold py-3 rounded-2xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '등록 중...' : '자녀 등록하기 🐣'}
        </button>
      </form>
    </div>
  )
}
