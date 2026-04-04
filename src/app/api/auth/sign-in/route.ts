import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

/**
 * 이메일·비밀번호로 세션을 만들고 Supabase 쿠키를 브라우저에 심습니다.
 * 클라이언트 signInWithPassword 가 "User not allowed" 를 내는 환경에서도
 * 동일 출처 + credentials: 'include' 로 쿠키가 맞게 붙도록 서버에서 처리합니다.
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

  const cookieStore = await cookies()
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          /* 일부 환경에서 Route Handler 쿠키 쓰기 제한 시 무시 */
        }
      },
    },
  })

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })

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

  return NextResponse.json({ ok: true }, { status: 200 })
}
