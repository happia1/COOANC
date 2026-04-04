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

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { role: 'parent', name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        const msg = error.message
        if (msg.includes('already registered') || msg.includes('already been registered')) {
          setError('이미 사용 중인 이메일이에요. 로그인해 주세요.')
        } else if (msg.includes('Database error')) {
          // 트리거 오류: 서버 API를 통해 직접 회원가입 시도
          const res = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name }),
          })
          let json: Record<string, unknown> = {}
          const text = await res.text()
          if (text) {
            try { json = JSON.parse(text) } catch { /* non-JSON response */ }
          }
          if (!res.ok) {
            setError(json.error ?? '회원가입에 실패했어요. 잠시 후 다시 시도해 주세요.')
            setLoading(false)
            return
          }
          if (json.session) {
            window.location.href = '/onboarding'
            return
          }
          setDone(true)
          setLoading(false)
          return
        } else {
          setError(msg)
        }
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
    } catch (err) {
      console.error('signup error:', err)
      setError('네트워크 오류가 발생했어요. 인터넷 연결을 확인해 주세요.')
      setLoading(false)
    }
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
        <Image src="/COOANC_Logo.png" alt="COOANC" width={320} height={320} className="rounded-2xl" style={{ height: 'auto' }} />
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
