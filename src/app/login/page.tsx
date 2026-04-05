'use client'

import { useState } from 'react'
import Image from 'next/image'
import { AUTH_LOGO_SRC } from '@/constants/branding'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    let data: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['data']
    try {
      const res = await supabase.auth.signInWithPassword({ email, password })
      if (res.error) {
        const msg = res.error.message
        if (msg === 'Invalid login credentials') {
          setError('이메일 또는 비밀번호가 맞지 않아요.')
        } else if (msg === 'Email not confirmed') {
          setError('이메일 인증이 필요해요. 받은 편지함에서 인증 링크를 확인해 주세요.')
        } else {
          setError(msg)
        }
        setLoading(false)
        return
      }
      data = res.data
    } catch (err) {
      console.error('login error:', err)
      setError('네트워크 오류가 발생했어요. 인터넷 연결을 확인해 주세요.')
      setLoading(false)
      return
    }

    const user = data.user
    if (!user) { setLoading(false); return }

    // 역할 확인
    const role = user.user_metadata?.role as string | undefined

    // 로그인 후 루트로 → 디바이스 모드 라우터가 적절한 화면으로 분기
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-green-50 flex flex-col items-center justify-center px-6">

      <div className="flex flex-col items-center gap-3 mb-8">
        <Image
          src={AUTH_LOGO_SRC}
          alt="COOANC"
          width={960}
          height={960}
          className="rounded-2xl max-w-[min(960px,calc(100vw-3rem))] w-full h-auto"
          priority
        />
        <p className="text-sm text-gray-400">자녀 경제 성장의 닻을 내리다</p>
      </div>

      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm bg-white rounded-3xl shadow-lg p-7 flex flex-col gap-4"
      >
        <h2 className="text-lg font-bold text-brand-text text-center">로그인</h2>

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
          <label className="text-xs font-bold text-gray-500" htmlFor="password">비밀번호</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
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
          {loading ? '로그인 중...' : '로그인'}
        </button>

        <p className="text-center text-xs text-gray-400">
          아직 계정이 없나요?{' '}
          <Link href="/signup" className="text-brand-blue font-bold underline underline-offset-2">
            회원가입
          </Link>
        </p>
      </form>
    </div>
  )
}
