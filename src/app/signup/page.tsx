'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Role = 'parent' | 'child'

const ROLE_OPTIONS: { value: Role; label: string; emoji: string; desc: string }[] = [
  { value: 'parent', emoji: '👨‍👩‍👧', label: '부모',   desc: '자녀 미션을 관리해요' },
  { value: 'child',  emoji: '🐣',       label: '자녀',   desc: '미션을 수행하고 크레딧을 모아요' },
]

export default function SignupPage() {
  const router = useRouter()
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole]         = useState<Role>('parent')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 해요.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    // Supabase Auth 가입 — raw_user_meta_data 에 role, name 전달
    // → DB 트리거 handle_new_user() 가 profiles 테이블 자동 생성
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role, name },
      },
    })

    if (error) {
      setError(
        error.message.includes('already registered')
          ? '이미 사용 중인 이메일이에요.'
          : error.message,
      )
      setLoading(false)
      return
    }

    // 가입 완료 후 홈으로 이동 (이메일 인증 미사용 시 바로 세션 발급)
    router.push('/home')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-green-50 flex flex-col items-center justify-center px-6 py-10">

      {/* 로고 */}
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

        {/* 역할 선택 */}
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

        {/* 이름 */}
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

        {/* 이메일 */}
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

        {/* 비밀번호 */}
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
