import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/auth/signup
 * 트리거 오류 시 폴백: service_role로 auth user + profile 직접 생성
 */
export async function POST(req: NextRequest) {
  let email: string, password: string, name: string
  try {
    ;({ email, password, name } = await req.json())
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 })
  }

  if (!email || !password || !name) {
    return NextResponse.json({ error: '필수 항목이 누락됐어요.' }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) {
    return NextResponse.json(
      {
        error:
          '서버에 SUPABASE_SERVICE_ROLE_KEY 가 없어요. Supabase 대시보드 → Project Settings → API → service_role (secret) 전체를 .env.local 에 넣고 개발 서버를 재시작해 주세요. (anon 키와 혼동하지 마세요)',
      },
      { status: 500 },
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!supabaseUrl) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_SUPABASE_URL 이 설정되지 않았어요.' }, { status: 500 })
  }

  const admin = createClient(
    supabaseUrl,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // auth user 생성 (이메일 확인 필요 → email_confirm: false)
  // 서버에서 생성하는 계정은 이메일 확인을 바로 완료 처리해 로그인까지 이어지기 쉽게 함
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'parent', name },
  })

  if (createErr) {
    const msg = createErr.message
    if (msg.includes('already registered') || msg.includes('email_exists')) {
      return NextResponse.json({ error: '이미 사용 중인 이메일이에요. 로그인해 주세요.' }, { status: 409 })
    }
    if (msg.includes('User not allowed')) {
      return NextResponse.json(
        {
          error:
            '계정 생성이 거절됐어요. (1) .env.local 의 SUPABASE_SERVICE_ROLE_KEY 가 Project Settings → API 의 service_role 전체인지 (anon 키와 바뀌지 않았는지) (2) 프로젝트가 일시정지 아닌지 확인해 주세요.',
        },
        { status: 403 },
      )
    }
    if (msg.includes('Database error') || msg.toLowerCase().includes('creating new user')) {
      return NextResponse.json(
        {
          error:
            'DB에서 신규 사용자를 만드는 중 오류가 났어요. 대시보드 → SQL Editor 에서 저장소의 supabase/migrations/018_fix_profiles_rls_and_handle_new_user.sql 내용을 실행해 주세요. (profiles RLS와 handle_new_user 트리거 수정)',
        },
        { status: 500 },
      )
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const userId = created.user.id

  // profiles 직접 삽입 (트리거가 이미 했을 수도 있으므로 ON CONFLICT 무시)
  await admin
    .from('profiles')
    .upsert({ id: userId, role: 'parent', name }, { onConflict: 'id', ignoreDuplicates: true })

  return NextResponse.json({ userId, session: null }, { status: 201 })
}
