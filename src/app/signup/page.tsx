'use client'

import { useState } from 'react'
import Image from 'next/image'
import { AUTH_LOGO_SRC } from '@/constants/branding'
import Link from 'next/link'
import { getSignupCatchMessage } from '@/lib/getSignupCatchMessage'
import { parseJsonFromResponse } from '@/lib/parseJsonResponse'
import { signupViaServerApi } from '@/lib/signupServerApi'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 해요.')
      return
    }

    setLoading(true)

    try {
      // ① service_role 로만 가입 (클라이언트 signUp 은 User not allowed 에 취약)
      const serverResult = await signupViaServerApi(email, password, name)

      if (serverResult.ok === false) {
        setError(serverResult.error)
        setLoading(false)
        return
      }

      // ② 세션은 서버 라우트에서 쿠키로 설정 (클라이언트 signIn 과 동일 anon 키지만 쿠키 처리가 안정적)
      const signInRes = await fetch('/api/auth/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })

      const { data: signInJson, parseError } = await parseJsonFromResponse<{
        error?: string
        ok?: boolean
      }>(signInRes)
      const body = signInJson ?? {}

      if (parseError) {
        setError('로그인 응답을 읽을 수 없어요. 잠시 후 다시 시도해 주세요.')
        setLoading(false)
        return
      }

      if (!signInRes.ok) {
        const errMsg =
          typeof body.error === 'string'
            ? body.error
            : '가입 후 로그인에 실패했어요. 로그인 페이지에서 다시 시도해 주세요.'
        setError(errMsg)
        setLoading(false)
        return
      }

      window.location.href = '/onboarding'
    } catch (err) {
      console.error('signup error:', err)
      setError(getSignupCatchMessage(err))
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-green-50 flex flex-col items-center justify-center px-6 py-10">
      <div className="flex flex-col items-center gap-3 mb-7">
        <Image src={AUTH_LOGO_SRC} alt="COOANC" width={320} height={320} className="rounded-2xl" style={{ height: 'auto' }} priority />
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
          <label className="text-xs font-bold text-gray-500" htmlFor="name">
            이름
          </label>
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
          <label className="text-xs font-bold text-gray-500" htmlFor="email">
            이메일
          </label>
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
