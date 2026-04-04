'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Role = 'parent' | 'child'

const ROLE_OPTIONS: { value: Role; label: string; emoji: string; desc: string }[] = [
  { value: 'parent', emoji: '👨‍👩‍👧', label: '부모',   desc: '자녀 미션을 관리해요' },
  { value: 'child',  emoji: '🐣',       label: '자녀',   desc: '미션을 수행하고 크레딧을 모아요' },
]

export default function SignupPage() {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole]         = useState<Role>('parent')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)  // 이메일 인증 대기 상태

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
        data: { role, name },
        // 이메일 인증 후 /auth/callback 으로 리다이렉트
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

    // 이메일 인증이 비활성화된 경우 → 세션 즉시 발급
    if (data.session) {
      window.location.href = '/home'
      return
    }

    // 이메일 인증이 필요한 경우 → 안내 화면 표시
    setDone(true)
    setLoading(false)
  }

  // ── 이메일 인증 안내 화면
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
              링크를 클릭하면 자동으로 로그인돼요.
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

      <div className="flex flex-col items-center gap-2 mb-7">
        <span className="text-6xl">🌱</span>
        <h1 className="text-2xl font-black text-brand-blue tracking-tight">COOANC</h1>
        <p className="text-sm text-gray-400">새로운 모험을 시작해요!</p>
      </div>

      <form
        onSubmit={handleSignup}
        className="w-full max-w-sm bg-white rounded-3xl shadow-lg p-7 flex flex-col gap-4"
      >
        <h2 className="text-lg font-bold text-brand-text text-center">회원가입</h2>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-gray-500">나는 누구인가요?</span>
          <div className="grid grid-cols-2 gap-2">
            {ROLE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRole(opt.value)}
                className={[
                  'flex flex-col items-center gap-1 py-3 rounded-2xl border-2 transition-all',
                  role === opt.value
                    ? 'border-brand-blue bg-brand-blue/5 scale-[1.02]'
                    : 'border-gray-100 bg-gray-50 hover:border-gray-200',
                ].join(' ')}
              >
                <span className="text-3xl leading-none">{opt.emoji}</span>
                <span className={`text-sm font-bold ${role === opt.value ? 'text-brand-blue' : 'text-gray-500'}`}>
                  {opt.label}
                </span>
                <span className="text-[10px] text-gray-400 text-center leading-tight px-1">
                  {opt.desc}
                </span>
              </button>
            ))}
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
            placeholder={role === 'child' ? '쿠앵이의 이름을 입력해요' : '부모님 이름을 입력해요'}
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
          className="mt-1 w-full bg-brand-green hover:bg-green-500 active:scale-95 text-white font-bold py-3 rounded-2xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '가입 중...' : '시작하기 🚀'}
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
