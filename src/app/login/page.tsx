'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { AUTH_LOGO_SRC } from '@/constants/branding'
import { BetaVersionMark } from '@/components/common/BetaVersionMark'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { runSerializedBrowserAuthOp } from '@/lib/supabase/browserAuthQueue'
import { mapSupabaseClientErrorMessage } from '@/lib/mapSupabaseClientErrorMessage'
import { parseJsonFromResponse } from '@/lib/parseJsonResponse'
import { useRouter } from 'next/navigation'

const AUTO_LOGIN_STORAGE_KEY = 'cooanc:auto-login-enabled'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [autoLoginEnabled, setAutoLoginEnabled] = useState(true)

  useEffect(() => {
    // 사용자가 이전에 선택한 자동 로그인 값을 복원합니다.
    const saved = window.localStorage.getItem(AUTO_LOGIN_STORAGE_KEY)
    if (saved === null) return
    setAutoLoginEnabled(saved === 'true')
  }, [])

  useEffect(() => {
    let cancelled = false
    async function redirectWhenAlreadySignedIn() {
      // 자동 로그인이 켜져 있고 HttpOnly 세션 쿠키가 있으면 로그인 화면을 건너뜁니다.
      // 브라우저 SDK `getSession()` 은 GoTrue Web Lock 과 겹치기 쉬워 같은 출처 API 만 씁니다.
      if (!autoLoginEnabled) return
      try {
        const res = await fetch('/api/auth/session', { credentials: 'same-origin' })
        const { data, parseError } = await parseJsonFromResponse<{ authenticated?: boolean }>(res)
        if (cancelled) return
        if (parseError || !data?.authenticated) return
        router.replace('/')
      } catch {
        /* 세션 확인 실패 시 로그인 폼 유지 */
      }
    }
    void redirectWhenAlreadySignedIn()
    return () => {
      cancelled = true
    }
  }, [autoLoginEnabled, router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // 브라우저 Supabase 싱글톤은 켜지는 순간 토큰 저장소(Web Lock)·자동 갱신이 돌아갈 수 있습니다.
    // 같은 탭에서 API 로그인과 겹치면 띅 경쟁·unhandledRejection 이 나기 쉬워, **API 실패 후**에만 만듭니다.
    // 1) 서버 Route Handler 로 로그인하면 응답에 심긴 세션 쿠키가 브라우저에 들어가기 쉽습니다.
    //    (클라이언트 SDK 만 쓸 때 차단되거나 허용되지 않은 요청 등이 나는 환경을 완화합니다.)
    try {
      const apiRes = await fetch('/api/auth/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password }),
      })
      // 네트워크/프록시가 HTML(<!DOCTYPE...)을 돌려주면 res.json() 이 "Unexpected token '<'" 을 냅니다 — text 로만 읽습니다.
      const { data: payload, parseError } = await parseJsonFromResponse<{
        ok?: boolean
        error?: string
      }>(apiRes)

      if (parseError || !payload) {
        console.warn(
          'sign-in API: JSON 이 아닌 응답(에러 페이지 HTML 등). 상태:',
          apiRes.status,
          '→ 브라우저 SDK 로 재시도합니다.',
        )
      } else if (apiRes.ok && payload.ok !== false) {
        // 세션 쿠키는 서버(API)가 Set-Cookie 로 이미 줬습니다. 여기서 다시 클라 SDK 로 로그인하면
        // 같은 탭에서 락 충돌·이중 요청 또는 잘못된 Supabase URL 시 HTML 파싱 오류만 늘 수 있어 생략합니다.
        window.localStorage.setItem(AUTO_LOGIN_STORAGE_KEY, String(autoLoginEnabled))
        window.location.href = '/'
        return
      } else if (payload.error) {
        setError(payload.error)
        setLoading(false)
        return
      }
    } catch (apiErr) {
      console.warn('sign-in API failed, fallback to client SDK:', apiErr)
    }

    const supabase = createClient()

    // 2) API 가 없거나 실패했을 때만 브라우저 SDK 로 재시도합니다.
    let data: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['data']
    try {
      const res = await runSerializedBrowserAuthOp(() =>
        supabase.auth.signInWithPassword({ email, password }),
      )
      if (res.error) {
        const raw = res.error.message
        const friendly = mapSupabaseClientErrorMessage(raw)
        if (raw === 'Invalid login credentials') {
          setError('이메일 또는 비밀번호가 맞지 않아요.')
        } else if (raw === 'Email not confirmed') {
          setError('이메일 인증이 필요해요. 받은 편지함에서 인증 링크를 확인해 주세요.')
        } else {
          setError(friendly)
        }
        setLoading(false)
        return
      }
      data = res.data
    } catch (err) {
      console.error('login error:', err)
      const hinted =
        typeof err === 'object' &&
        err !== null &&
        'message' in err &&
        typeof (err as { message: unknown }).message === 'string'
          ? mapSupabaseClientErrorMessage((err as { message: string }).message)
          : null
      setError(hinted ?? '네트워크 오류가 발생했어요. 인터넷 연결을 확인해 주세요.')
      setLoading(false)
      return
    }

    const sdkUser = data.user
    if (!sdkUser) {
      setError('로그인에 실패했어요. 잠시 후 다시 시도해 주세요.')
      setLoading(false)
      return
    }

    // 다음 접속 시 같은 선택을 유지하도록 자동 로그인 설정을 저장합니다.
    window.localStorage.setItem(AUTO_LOGIN_STORAGE_KEY, String(autoLoginEnabled))

    // 로그인 후 루트로 → 역할별 화면으로 분기합니다.
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-green-50 flex flex-col items-center justify-center px-6">

      <div className="flex flex-col items-center gap-3 mb-8">
        <BetaVersionMark />
        {/* 로고 표시 크기: 기존 대비 가로·세로 절반(Next Image intrinsic 비율 유지) */}
        <Image
          src={AUTH_LOGO_SRC}
          alt="COOANC"
          width={240}
          height={240}
          sizes="(max-width: 480px) min(240px, calc(100vw - 3rem)), 240px"
          className="rounded-2xl max-w-[min(240px,calc(100vw-3rem))] h-auto w-auto"
          priority
          // Next 권고: width/height 중 하나만 CSS로 바꿀 때 나머지 한 축을 auto 로 둡니다(둘 다 명시).
          style={{ width: 'auto', height: 'auto' }}
        />
        <p className="text-sm text-gray-400">자녀 성장의 닻을 내리다</p>
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

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={autoLoginEnabled}
            onChange={e => setAutoLoginEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue/40"
          />
          자동 로그인하기
        </label>

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
