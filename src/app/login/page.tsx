'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { AUTH_LOGO_SRC } from '@/constants/branding'
import { BetaVersionMark } from '@/components/common/BetaVersionMark'
import Link from 'next/link'
import ChildAppTransitionOverlay from '@/components/child/ChildAppTransitionOverlay'
import { createClient } from '@/lib/supabase/client'
import { runSerializedBrowserAuthOp } from '@/lib/supabase/browserAuthQueue'
import {
  readAutoLoginEnabled,
  writeAutoLoginEnabled,
} from '@/lib/autoLoginPreference'
import {
  AUTO_LOGIN_CHECKING_MESSAGE,
  getTransitionForAutoLoginTarget,
  type AutoLoginTransitionPresentation,
} from '@/lib/autoLoginTransitionPresentation'
import { mapSupabaseClientErrorMessage } from '@/lib/mapSupabaseClientErrorMessage'
import { parseJsonFromResponse } from '@/lib/parseJsonResponse'
import { pickPostLoginNavigationTarget } from '@/lib/pickPostLoginNavigationTarget'
import type { PostLoginRedirectPlan } from '@/lib/resolvePostLoginRedirect'

export default function LoginPage() {
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  /** localStorage 를 읽기 전에는 로그인 폼을 그리지 않습니다 */
  const [autoLoginPrefsReady, setAutoLoginPrefsReady] = useState(false)
  const [autoLoginEnabled, setAutoLoginEnabled] = useState(true)
  /** 자동 로그인 켜짐 — 세션 확인·이동 동안 로그인 폼 대신 전환 화면만 표시 */
  const [autoLoginGateActive, setAutoLoginGateActive] = useState(false)
  const [autoLoginTransition, setAutoLoginTransition] = useState<AutoLoginTransitionPresentation>({
    message: AUTO_LOGIN_CHECKING_MESSAGE,
    background: 'parent',
  })

  /** 맨 아래 「개발자 로그인」 — 비밀번호만으로 콘텐츠 관리 화면에 들어갑니다 */
  const [devLoginOpen, setDevLoginOpen] = useState(false)
  const [devPassword, setDevPassword] = useState('')
  const [devError, setDevError] = useState<string | null>(null)
  const [devLoading, setDevLoading] = useState(false)

  async function submitDevLogin() {
    if (devLoading || !devPassword) return
    setDevLoading(true)
    setDevError(null)
    try {
      const res = await fetch('/api/admin/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: devPassword }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setDevError(json.error ?? '들어갈 수 없어요')
        return
      }
      window.location.href = '/admin/content'
    } catch {
      setDevError('네트워크 오류가 발생했어요')
    } finally {
      setDevLoading(false)
    }
  }

  useEffect(() => {
    setAutoLoginEnabled(readAutoLoginEnabled())
    setAutoLoginPrefsReady(true)
  }, [])

  useEffect(() => {
    if (!autoLoginPrefsReady) return

    if (!autoLoginEnabled) {
      setAutoLoginGateActive(false)
      return
    }

    setAutoLoginGateActive(true)
    setAutoLoginTransition({
      message: AUTO_LOGIN_CHECKING_MESSAGE,
      background: 'parent',
    })

    let cancelled = false

    /**
     * 자동 로그인 확인이 늦어져도 **로그인 화면이 반드시 나오게** 하는 안전장치.
     *
     * 비개발자 설명(신고된 문제):
     *   이 확인이 끝나기 전까지는 로그인 입력칸이 화면에 아예 그려지지 않습니다.
     *   그런데 서버가 느릴 때 이 확인 요청에 시간 제한이 없어서, 「확인 중」 화면에 갇힌 채
     *   로그인을 시도조차 할 수 없었습니다. 이제 아래 시간이 지나면 확인을 포기하고
     *   로그인 폼을 띄웁니다(로그인 자체는 정상적으로 다시 시도할 수 있습니다).
     */
    const AUTO_LOGIN_CHECK_TIMEOUT_MS = 4000
    const controller = new AbortController()
    const giveUpTimer = window.setTimeout(() => {
      controller.abort()
      if (!cancelled) setAutoLoginGateActive(false)
    }, AUTO_LOGIN_CHECK_TIMEOUT_MS)

    async function redirectWhenAlreadySignedIn() {
      try {
        const res = await fetch('/api/auth/post-login-redirect', {
          credentials: 'same-origin',
          signal: controller.signal,
        })
        const { data, parseError } = await parseJsonFromResponse<PostLoginRedirectPlan>(res)
        if (cancelled || parseError || !data?.authenticated) {
          if (!cancelled) setAutoLoginGateActive(false)
          return
        }
        const target = pickPostLoginNavigationTarget(data)
        if (!target || cancelled) {
          if (!cancelled) setAutoLoginGateActive(false)
          return
        }
        const presentation = getTransitionForAutoLoginTarget(target)
        if (!cancelled) setAutoLoginTransition(presentation)
        window.location.replace(target)
      } catch {
        /** 시간 초과·네트워크 오류 — 로그인 폼을 보여 주고 직접 로그인하게 합니다 */
        if (!cancelled) setAutoLoginGateActive(false)
      } finally {
        window.clearTimeout(giveUpTimer)
      }
    }
    void redirectWhenAlreadySignedIn()
    return () => {
      cancelled = true
      window.clearTimeout(giveUpTimer)
      controller.abort()
    }
  }, [autoLoginEnabled, autoLoginPrefsReady])

  const showAutoLoginTransition = !autoLoginPrefsReady || autoLoginGateActive

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
        writeAutoLoginEnabled(autoLoginEnabled)
        const navRes = await fetch('/api/auth/post-login-redirect', { credentials: 'same-origin' })
        const { data: plan, parseError: navParseError } =
          await parseJsonFromResponse<PostLoginRedirectPlan>(navRes)
        const target =
          !navParseError && plan?.authenticated ? pickPostLoginNavigationTarget(plan) : null
        window.location.replace(target ?? '/parent/home')
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
    type SignInWithPasswordResult = Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>
    let data: SignInWithPasswordResult['data']
    try {
      const res = await runSerializedBrowserAuthOp<SignInWithPasswordResult>(() =>
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
    writeAutoLoginEnabled(autoLoginEnabled)

    const navRes = await fetch('/api/auth/post-login-redirect', { credentials: 'same-origin' })
    const { data: plan, parseError: navParseError } =
      await parseJsonFromResponse<PostLoginRedirectPlan>(navRes)
    const target =
      !navParseError && plan?.authenticated ? pickPostLoginNavigationTarget(plan) : null
    window.location.replace(target ?? '/parent/home')
  }

  if (showAutoLoginTransition) {
    return (
      <ChildAppTransitionOverlay
        statusMessage={autoLoginTransition.message}
        background={autoLoginTransition.background}
      />
    )
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

        {/*
          운영자(개발자) 진입 — 일반 사용자 눈에 잘 띄지 않도록 맨 아래 흐린 작은 글씨로 둡니다.
          별도 계정을 만들지 않고 비밀번호만으로 콘텐츠 관리 화면에 들어갑니다.
        */}
        <div className="pt-2 text-center">
          {devLoginOpen ? (
            <div className="mx-auto flex max-w-[15rem] flex-col gap-1.5">
              <input
                type="password"
                value={devPassword}
                onChange={(e) => setDevPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void submitDevLogin()
                  }
                }}
                placeholder="개발자 비밀번호"
                className="rounded-lg border border-gray-200 px-3 py-2 text-center text-xs text-brand-text placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
              />
              {devError ? <p className="text-[11px] text-red-500">{devError}</p> : null}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setDevLoginOpen(false)
                    setDevPassword('')
                    setDevError(null)
                  }}
                  className="flex-1 rounded-lg bg-gray-100 py-2 text-[11px] font-bold text-gray-500"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={devLoading || !devPassword}
                  onClick={() => void submitDevLogin()}
                  className="flex-1 rounded-lg bg-gray-700 py-2 text-[11px] font-bold text-white disabled:opacity-40"
                >
                  {devLoading ? '확인 중…' : '들어가기'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setDevLoginOpen(true)}
              className="text-[10px] text-gray-300 underline underline-offset-2"
            >
              개발자 로그인
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
