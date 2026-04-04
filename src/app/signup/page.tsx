'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 해요.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role: 'parent', name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(
        error.message.includes('already registered') || error.message.includes('already been registered')
          ? '이미 사용 중인 이메일이에요. 로그인해 주세요.'
          : error.message,
      )
      setLoading(false)
      return
    }

    // 이메일 인증 불필요(개발 환경) → 바로 온보딩으로
    if (data.session) {
      window.location.href = '/onboarding'
      return
    }

    // 이메일 인증 필요 → 안내 화면
    setDone(true)
    setLoading(false)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-green-50 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-lg p-8 flex flex-col items-center gap-5 text-center">
          <span className="text-7xl">📬</span>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-brand-text">이메일을 확인해 주세요!</h2>
            <p className="text-sm text-gray-500">
              <span className="font-bold text-brand-blue">{email}</span>로<br />
              인증 링크를 보냈어요.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              링크를 클릭하면 자동으로 자녀 등록 화면으로 이동해요.
            </p>
          </div>
          <Link
            href="/login"
            className="w-full text-center bg-brand-blue text-white font-bold py-3 rounded-2xl shadow-md transition-all active:scale-95"
          >
            로그인 페이지로
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-green-50 flex flex-col items-center justify-center px-6 py-10">

      <div className="flex flex-col items-center gap-3 mb-7">
        <Image src="/COOANC_Logo.png" alt="COOANC" width={64} height={64} className="rounded-2xl" style={{ height: 'auto' }} />
        <h1 className="text-2xl font-black text-brand-blue tracking-tight">COOANC</h1>
        <p className="text-sm text-gray-400">자녀 경제 성장의 닻을 내리다</p>
      </div>

      <form
        onSubmit={handleSignup}
        className="w-full max-w-sm bg-white rounded-3xl shadow-lg p-7 flex flex-col gap-4"
      >
        <div className="text-center">
          <h2 className="text-lg font-bold text-brand-text">부모 계정 만들기</h2>
          <p className="text-xs text-gray-400 mt-1">부모 계정을 먼저 만든 뒤, 자녀 프로필을 등록해요</p>
        </div>

        {/* 부모 전용 안내 배너 */}
        <div className="flex items-start gap-2 bg-brand-blue/5 border border-brand-blue/20 rounded-2xl px-3.5 py-3">
          <span className="text-xl leading-none mt-0.5">👨‍👩‍👧</span>
          <div>
            <p className="text-xs font-bold text-brand-blue">부모(보호자) 계정</p>
            <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5">
              자녀 미션 관리, 크레딧 승인, 성장 대시보드를 이용할 수 있어요.
              자녀 프로필은 가입 후 등록해요.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-500" htmlFor="name">이름</label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="부모님 이름을 입력해요"
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-brand-text placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-500" htmlFor="email">이메일</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="example@email.com"
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-brand-text placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-500" htmlFor="password">
            비밀번호 <span className="font-normal text-gray-400">(6자 이상)</span>
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-brand-text placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition"
          />
        </div>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 w-full bg-brand-blue hover:bg-blue-600 active:scale-95 text-white font-bold py-3 rounded-2xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '가입 중...' : '시작하기'}
        </button>

        <p className="text-center text-xs text-gray-400">
          이미 계정이 있나요?{' '}
          <Link href="/login" className="text-brand-blue font-bold underline underline-offset-2">
            로그인
          </Link>
        </p>
      </form>
    </div>
  )
}
