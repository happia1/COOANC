import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import {
  applyCookieCacheHeaders,
  type SupabaseCookieHeaders,
} from '@/lib/supabase/supabaseSetAllCacheHeaders'

export const dynamic = 'force-dynamic'

/** Supabase 가 응답 없이 매우 오래 걸릴 때(네트워크·URL 오류 등) 클라이언트가 수십 초 멈추지 않게 상한을 둡니다. */
const SIGN_IN_TIMEOUT_MS = 25_000

/**
 * 이메일·비밀번호로 세션을 만들고 Supabase 쿠키를 브라우저에 심습니다.
 *
 * 비개발자 설명:
 * - 예전에는 `cookies()` 로만 쿠키를 썼는데, App Router 의 Route Handler 에서는
 *   그 값이 최종 HTTP 응답(`Set-Cookie`)에 안 붙는 경우가 있어요.
 * - 그러면 서버는 "로그인 성공(ok)" 이라고 답하지만 브라우저에는 세션이 저장되지 않고,
 *   곧바로 다시 로그인 화면으로 돌아가는 것처럼 보일 수 있습니다.
 * - 그래서 Supabase 가 내려 주는 쿠키를 **이 핸들러가 돌려주는 JSON 응답 객체**에 직접 붙입니다.
 *
 * 클라이언트 `signInWithPassword` 가 "User not allowed" 를 내는 환경에서도
 * 동일 출처 + `credentials: 'include'` 로 쿠키를 맞추려는 목적은 그대로입니다.
 */
export async function POST(req: NextRequest) {
  let email: string
  let password: string
  try {
    ;({ email, password } = await req.json())
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 })
  }

  if (!email?.trim() || !password) {
    return NextResponse.json({ error: '이메일과 비밀번호를 입력해 주세요.' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !anon) {
    return NextResponse.json({ error: 'Supabase 환경 변수가 설정되지 않았어요.' }, { status: 500 })
  }

  // 로그인 성공 시 이 응답에 세션 쿠키를 쌓아서 브라우저로 보냅니다.
  const response = NextResponse.json({ ok: true }, { status: 200 })

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(cookiesToSet, cookieHeaders?: SupabaseCookieHeaders) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
        applyCookieCacheHeaders(response.headers, cookieHeaders)
      },
    },
  })

  const signInPromise = supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('SIGN_IN_TIMEOUT')), SIGN_IN_TIMEOUT_MS)
  })

  let signInResult: Awaited<typeof signInPromise>
  try {
    signInResult = await Promise.race([signInPromise, timeoutPromise])
  } catch (raceErr) {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
    if (raceErr instanceof Error && raceErr.message === 'SIGN_IN_TIMEOUT') {
      return NextResponse.json(
        {
          error:
            '로그인 서버(Supabase) 응답이 너무 오래 걸렸어요. NEXT_PUBLIC_SUPABASE_URL·네트워크(VPN·방화벽)·Supabase 상태를 확인해 주세요.',
        },
        { status: 504 },
      )
    }
    throw raceErr
  }
  if (timeoutId !== undefined) clearTimeout(timeoutId)

  const { error } = signInResult

  if (error) {
    const msg = error.message
    if (msg === 'Invalid login credentials') {
      return NextResponse.json({ error: '이메일 또는 비밀번호가 맞지 않아요.' }, { status: 401 })
    }
    if (msg.includes('User not allowed')) {
      return NextResponse.json(
        {
          error:
            '로그인이 허용되지 않았어요. Supabase 대시보드 → Authentication → Providers → Email 이 켜져 있는지, 이메일 인증이 필요한지 확인해 주세요.',
        },
        { status: 403 },
      )
    }
    return NextResponse.json({ error: msg }, { status: 401 })
  }

  return response
}
