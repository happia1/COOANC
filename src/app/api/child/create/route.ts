import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getAgeFromBirthDateIso } from '@/lib/ageFromBirthDate'
import { isRetriableMissingColumnError } from '@/lib/supabase/childProfileSelect'

/**
 * POST /api/child/create
 * 부모가 자녀 프로필을 생성합니다.
 * - Supabase Admin API로 자녀 auth 계정 생성 (이메일 인증 불필요)
 * - profiles 트리거가 자동으로 자녀 프로필 생성
 * - child_stats, family_links 레코드 생성
 * - 생년월일(YYYY-MM-DD)로 만 1~18세를 검증하고 profiles.age 에도 동기화합니다.
 */
export async function POST(req: NextRequest) {
  let name: string
  let birthDate: string
  let pin: string
  let parentId: string
  try {
    ;({ name, birthDate, pin, parentId } = await req.json())
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 })
  }

  if (!name || !birthDate || !pin || !parentId) {
    return NextResponse.json({ error: '필수 항목이 누락됐어요.' }, { status: 400 })
  }

  const age = getAgeFromBirthDateIso(birthDate)
  if (age === null) {
    return NextResponse.json(
      { error: '생년월일을 확인해 주세요. 만 1~18세만 등록할 수 있어요.' },
      { status: 400 },
    )
  }

  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN은 4자리 숫자여야 해요.' }, { status: 400 })
  }

  // 서버 Supabase 클라이언트로 요청자 인증 확인
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()

  if (authErr || !user || user.id !== parentId) {
    return NextResponse.json({ error: '인증되지 않은 요청이에요.' }, { status: 401 })
  }

  // Admin 클라이언트 (service_role key 필요)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // 자녀 전용 내부 이메일 생성 (실제 이메일 불필요)
  const childEmail = `child+${crypto.randomUUID()}@cooanc.internal`

  // auth.users에 자녀 계정 생성 (이메일 확인 건너뜀)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: childEmail,
    password: pin,
    email_confirm: true,
    user_metadata: { role: 'child', name, birth_date: birthDate, age },
  })

  if (createErr || !created.user) {
    console.error('child createUser error:', createErr)
    return NextResponse.json({ error: '자녀 계정 생성에 실패했어요.' }, { status: 500 })
  }

  const childId = created.user.id

  // child_stats 초기 레코드 생성
  const { error: statsErr } = await admin
    .from('child_stats')
    .insert({ child_id: childId })

  if (statsErr) {
    console.error('child_stats insert error:', statsErr)
    // 롤백: auth user 삭제
    await admin.auth.admin.deleteUser(childId)
    return NextResponse.json({ error: '자녀 초기 데이터 생성에 실패했어요.' }, { status: 500 })
  }

  // family_links 생성 (부모 ↔ 자녀 연결)
  const { error: linkErr } = await admin
    .from('family_links')
    .insert({ parent_id: parentId, child_id: childId })

  if (linkErr) {
    console.error('family_links insert error:', linkErr)
    await admin.auth.admin.deleteUser(childId)
    return NextResponse.json({ error: '가족 연결 생성에 실패했어요.' }, { status: 500 })
  }

  // 트리거로 만든 profiles 행 보강 — DB 마다 age / birth_date 컬럼 유무가 달라 단계적으로 시도
  const profilePatches: Record<string, string | number>[] = [
    { birth_date: birthDate, age, name },
    { age, name },
    { birth_date: birthDate, name },
    { name },
  ]
  let lastProfileErr: { message: string } | null = null
  for (const patch of profilePatches) {
    const up = await admin.from('profiles').update(patch).eq('id', childId)
    if (!up.error) {
      lastProfileErr = null
      break
    }
    lastProfileErr = { message: up.error.message }
    if (!isRetriableMissingColumnError(up.error)) {
      console.error('profiles update:', up.error)
      break
    }
  }
  if (lastProfileErr) {
    console.error('profiles update (모든 폴백 실패):', lastProfileErr.message)
  }

  return NextResponse.json({ childId, name }, { status: 201 })
}
