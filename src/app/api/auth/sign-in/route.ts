import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import {
  applyCookieCacheHeaders,
  type SupabaseCookieHeaders,
} from '@/lib/supabase/supabaseSetAllCacheHeaders'

export const dynamic = 'force-dynamic'

/**
 * 로그인 응답을 기다리는 상한.
 *
 * 비개발자 설명: 예전에는 25초였습니다. 그런데 Supabase 가 8초 안에 답하지 못하면
 * 그 뒤로 기다려 봐야 성공하는 경우가 거의 없고, 아이·부모는 멈춘 화면을 25초나 봐야 했습니다.
 * (게다가 25초는 배포 환경의 함수 실행 한도에 걸려 우리 안내 문구 대신
 *  낯선 오류 페이지가 뜰 수 있는 길이입니다.)
 * 그래서 8초로 줄이고, 대신 "다시 시도해 주세요" 를 빨리 보여 줍니다.
 */
const SIGN_IN_TIMEOUT_MS = 8_000

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
      /**
       * 기술적인 원인은 서버 로그에만 남깁니다.
       * 화면에는 부모·아이가 읽을 수 있는 말만 보여 주고, 운영자는 로그에서 확인합니다.
       */
      console.error(
        `[auth/sign-in] Supabase 응답 없음 (${SIGN_IN_TIMEOUT_MS}ms 초과) — NEXT_PUBLIC_SUPABASE_URL·네트워크·Supabase 상태 확인 필요`,
      )
      return NextResponse.json(
        {
          error:
            '로그인 서버 응답이 늦어요. 잠시 후 다시 시도해 주세요. (계속 안 되면 인터넷 연결을 확인해 주세요.)',
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
