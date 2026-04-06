import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getAgeFromBirthDateIso } from '@/lib/ageFromBirthDate'

const INSTITUTIONS = new Set(['home', 'daycare', 'kindergarten', 'school'])

/**
 * POST /api/child/update-profile
 * 연결된 부모가 자녀 profiles(이름·생년월일·나이·보육/통학 형태)를 수정합니다.
 * - RLS 는 자녀 행을 부모가 직접 못 고치므로 service_role 로 갱신합니다.
 * - 자녀 로그인 시 표시용으로 auth.user_metadata 도 같이 맞춥니다.
 */
const AGE_GROUPS = new Set(['preschool', 'school'])

export async function POST(req: NextRequest) {
  let childId: string
  let name: string | undefined
  let birthDate: string | undefined
  let institutionType: string | undefined
  /** 루틴 온보딩 등에서만 넘깁니다 — profiles.age_group 갱신 */
  let ageGroup: string | undefined
  try {
    const body = await req.json()
    childId = body?.childId
    name = typeof body?.name === 'string' ? body.name : undefined
    birthDate = typeof body?.birthDate === 'string' ? body.birthDate.trim() : undefined
    institutionType = typeof body?.institutionType === 'string' ? body.institutionType.trim() : undefined
    ageGroup = typeof body?.ageGroup === 'string' ? body.ageGroup.trim() : undefined
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 })
  }

  if (!childId) {
    return NextResponse.json({ error: 'childId가 필요해요.' }, { status: 400 })
  }

  if (name === undefined && birthDate === undefined && institutionType === undefined && ageGroup === undefined) {
    return NextResponse.json({ error: '수정할 항목이 없어요.' }, { status: 400 })
  }

  if (institutionType !== undefined && !INSTITUTIONS.has(institutionType)) {
    return NextResponse.json({ error: '보육·통학 형태 값이 올바르지 않아요.' }, { status: 400 })
  }

  if (ageGroup !== undefined && !AGE_GROUPS.has(ageGroup)) {
    return NextResponse.json({ error: '연령대 값이 올바르지 않아요.' }, { status: 400 })
  }

  if (birthDate !== undefined && getAgeFromBirthDateIso(birthDate) === null) {
    return NextResponse.json(
      { error: '생년월일을 확인해 주세요. 만 1~18세만 등록할 수 있어요.' },
      { status: 400 },
    )
  }

  const supabase = await createServerClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 })
  }

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'parent') {
    return NextResponse.json({ error: '부모 계정만 수정할 수 있어요.' }, { status: 403 })
  }

  const { data: link } = await supabase
    .from('family_links')
    .select('id')
    .eq('parent_id', user.id)
    .eq('child_id', childId)
    .maybeSingle()

  if (!link) {
    return NextResponse.json({ error: '해당 자녀와 연결되어 있지 않아요.' }, { status: 403 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('[child/update-profile] 환경 변수 누락')
    return NextResponse.json({ error: '서버 설정 오류예요.' }, { status: 500 })
  }

  const admin = createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: childRow, error: readErr } = await admin
    .from('profiles')
    .select('role, name, birth_date, age')
    .eq('id', childId)
    .maybeSingle()

  if (readErr || !childRow || childRow.role !== 'child') {
    return NextResponse.json({ error: '자녀 프로필을 찾을 수 없어요.' }, { status: 404 })
  }

  const patch: Record<string, string | number> = {}
  if (name !== undefined) {
    const trimmed = name.trim()
    patch.name = trimmed || (typeof childRow.name === 'string' ? childRow.name : '자녀')
  }
  if (birthDate !== undefined) {
    patch.birth_date = birthDate
    const a = getAgeFromBirthDateIso(birthDate)
    if (a !== null) patch.age = a
  }
  if (institutionType !== undefined) patch.institution_type = institutionType
  if (ageGroup !== undefined) patch.age_group = ageGroup

  const { error: upErr } = await admin.from('profiles').update(patch).eq('id', childId)
  if (upErr) {
    console.error('[child/update-profile] profiles update:', upErr)
    return NextResponse.json({ error: '저장에 실패했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
  }

  const { data: fresh } = await admin.from('profiles').select('name, birth_date, age').eq('id', childId).maybeSingle()

  const { error: metaErr } = await admin.auth.admin.updateUserById(childId, {
    user_metadata: {
      role: 'child',
      name: fresh?.name ?? '',
      ...(fresh?.birth_date ? { birth_date: fresh.birth_date } : {}),
      ...(typeof fresh?.age === 'number' ? { age: fresh.age } : {}),
    },
  })
  if (metaErr) {
    console.warn('[child/update-profile] auth metadata:', metaErr.message)
  }

  return NextResponse.json({ ok: true })
}
