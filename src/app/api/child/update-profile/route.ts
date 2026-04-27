import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient, serviceRoleEnvMissingMessage } from '@/lib/supabase/admin'
import { getAgeFromBirthDateIso } from '@/lib/ageFromBirthDate'
import { isAllowedChildProfileAvatarUrl } from '@/lib/childProfileAvatar'

const INSTITUTIONS = new Set(['home', 'daycare', 'kindergarten', 'school'])

/**
 * POST /api/child/update-profile
 * 연결된 부모가 자녀 profiles(이름·생년월일·나이·보육/통학 형태·프로필 이미지 URL)를 수정합니다.
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
  /**
   * 휴일 루틴: 평일과 동일(as_weekday) / 휴일만 따로(custom).
   * `custom` 인데 weekly 미션이 0개여도(휴일 칩 비움) 주말에 daily 를 백필하지 않도록 저장합니다.
   */
  let holidayRoutineMode: 'as_weekday' | 'custom' | undefined
  /** undefined = 안 바꿈, null = 사진 제거(DB null), 문자열 = 허용된 경로만 */
  let avatarUrlPatch: string | null | undefined
  try {
    const body = await req.json()
    childId = body?.childId
    name = typeof body?.name === 'string' ? body.name : undefined
    birthDate = typeof body?.birthDate === 'string' ? body.birthDate.trim() : undefined
    institutionType = typeof body?.institutionType === 'string' ? body.institutionType.trim() : undefined
    ageGroup = typeof body?.ageGroup === 'string' ? body.ageGroup.trim() : undefined
    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'holidayRoutineMode')) {
      const h = (body as { holidayRoutineMode?: unknown }).holidayRoutineMode
      if (h === 'as_weekday' || h === 'custom') holidayRoutineMode = h
      else if (h !== undefined && h !== null) {
        return NextResponse.json({ error: '휴일 루틴 모드 값이 올바르지 않아요.' }, { status: 400 })
      }
    }
    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'avatarUrl')) {
      const raw = (body as { avatarUrl?: unknown }).avatarUrl
      if (raw === null || raw === '') {
        avatarUrlPatch = null
      } else if (typeof raw === 'string') {
        const t = raw.trim()
        if (!isAllowedChildProfileAvatarUrl(t)) {
          return NextResponse.json({ error: '허용되지 않은 프로필 이미지예요.' }, { status: 400 })
        }
        avatarUrlPatch = t
      } else {
        return NextResponse.json({ error: '프로필 이미지 값이 올바르지 않아요.' }, { status: 400 })
      }
    }
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 })
  }

  if (!childId) {
    return NextResponse.json({ error: 'childId가 필요해요.' }, { status: 400 })
  }

  if (
    name === undefined &&
    birthDate === undefined &&
    institutionType === undefined &&
    ageGroup === undefined &&
    holidayRoutineMode === undefined &&
    avatarUrlPatch === undefined
  ) {
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

  const admin = createServiceRoleClient()
  if (!admin) {
    const detail = serviceRoleEnvMissingMessage()
    console.error('[child/update-profile] service_role 클라이언트 생성 실패:', detail || '(원인 불명)')
    return NextResponse.json(
      {
        error: [
          detail || 'Supabase service_role 연결 정보를 읽지 못했어요.',
          '`.env.local` 또는 배포 환경에 키 이름을 다시 확인하고, 값을 큰따옴표로 감싸지 않은 채 저장한 뒤 개발 서버를 완전히 재시작해 주세요.',
          '자녀 프로필은 RLS 때문에 이 API만 service_role 로 갱신합니다.',
        ].join(' '),
      },
      { status: 500 },
    )
  }

  const { data: childRow, error: readErr } = await admin
    .from('profiles')
    .select('role, name, birth_date, age')
    .eq('id', childId)
    .maybeSingle()

  if (readErr || !childRow || childRow.role !== 'child') {
    return NextResponse.json({ error: '자녀 프로필을 찾을 수 없어요.' }, { status: 404 })
  }

  /** `avatar_url` 을 비울 때 `null` 이 필요해 `string | number | null` 을 허용합니다. */
  const patch: Record<string, string | number | null> = {}
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
  if (holidayRoutineMode !== undefined) patch.holiday_routine_mode = holidayRoutineMode
  if (avatarUrlPatch !== undefined) patch.avatar_url = avatarUrlPatch

  const { error: upErr } = await admin.from('profiles').update(patch).eq('id', childId)
  if (upErr) {
    console.error('[child/update-profile] profiles update:', upErr)
    return NextResponse.json({ error: '저장에 실패했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
  }
  /** 저장 직후 같은 연결로 다시 읽어, 클라이언트 재조회 지연 없이 UI 가 맞출 수 있게 합니다. */
  const { data: fresh } = await admin
    .from('profiles')
    .select('name, birth_date, age, avatar_url')
    .eq('id', childId)
    .maybeSingle()

  const freshAvatar =
    fresh && typeof (fresh as { avatar_url?: unknown }).avatar_url === 'string'
      ? (fresh as { avatar_url: string }).avatar_url.trim() || null
      : null

  const { error: metaErr } = await admin.auth.admin.updateUserById(childId, {
    user_metadata: {
      role: 'child',
      name: fresh?.name ?? '',
      ...(fresh?.birth_date ? { birth_date: fresh.birth_date } : {}),
      ...(typeof fresh?.age === 'number' ? { age: fresh.age } : {}),
      /** 자녀 클라이언트가 메타데이터만 볼 때도 홈 캐릭터와 맞추기 위함(주 소스는 여전히 `profiles`) */
      ...(freshAvatar !== null ? { avatar_url: freshAvatar } : { avatar_url: null }),
    },
  })
  if (metaErr) {
    console.warn('[child/update-profile] auth metadata:', metaErr.message)
  }

  /**
   * 부모 홈은 자녀 프로필을 서버 캐시로 읽기 때문에,
   * 저장 직후 해당 태그를 무효화해서 즉시 최신 이름/아바타를 보이게 합니다.
   */
  // Next.js 최신 타입 시그니처: revalidateTag(tag, profile)
  // 즉시 재검증 의도를 명확히 하기 위해 "max" 프로필을 사용합니다.
  revalidateTag('parent-home-child-profiles', 'max')

  return NextResponse.json({ ok: true, profile: { avatar_url: freshAvatar } })
}
