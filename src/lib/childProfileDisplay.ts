/**
 * 자녀 프로필 카드·설정 화면에서 공통으로 쓰는 표시용 문구입니다.
 * - 연령대(미취학/학령기): DB age_group이 있으면 우선하고, 없으면 만 나이(7세 이상이면 학령기)로 추정합니다.
 * - 보육·통학: DB institution_type 코드를 온보딩·설정과 같은 한글 라벨로 바꿉니다.
 */

/** DB profiles.age_group 과 동일한 값 */
export type ProfileAgeGroup = 'preschool' | 'school'

/** DB profiles.institution_type 과 동일한 값 */
export type ProfileInstitution = 'home' | 'daycare' | 'kindergarten' | 'school'

/**
 * 표시에 쓸 연령대를 정합니다.
 * - 저장된 age_group이 preschool/school 이면 그대로 사용합니다.
 * - 없으면 만 나이가 7 이상이면 학령기, 미만이면 미취학으로 봅니다.
 * - 나이도 없으면 미취학으로 둡니다(보수적 기본값).
 */
export function resolveProfileAgeGroup(
  dbAgeGroup: string | null | undefined,
  displayAge: number | null,
): ProfileAgeGroup {
  if (dbAgeGroup === 'preschool' || dbAgeGroup === 'school') {
    return dbAgeGroup
  }
  if (displayAge !== null && displayAge >= 7) {
    return 'school'
  }
  return 'preschool'
}

/** 카드 한 줄에 넣는 짧은 연령대 이름 */
export function profileAgeGroupShortLabel(ag: ProfileAgeGroup): string {
  return ag === 'school' ? '학령기' : '미취학'
}

/**
 * 연령대에 허용된 기관 코드만 남깁니다(잘못된 조합이면 안전한 기본값).
 * ChildProfileEditModal 의 normalizeInstitutionForGroup 과 같은 규칙입니다.
 */
export function normalizeInstitutionForAgeGroup(
  ag: ProfileAgeGroup,
  raw: string | null | undefined,
): ProfileInstitution {
  const allowed =
    ag === 'preschool'
      ? (['home', 'daycare', 'kindergarten'] as const)
      : (['school', 'home'] as const)
  const v = (raw ?? 'home') as ProfileInstitution
  if ((allowed as readonly string[]).includes(v)) {
    return v
  }
  return ag === 'preschool' ? 'home' : 'school'
}

/**
 * 보육·통학 형태를 사람이 읽기 좋은 문자열로 바꿉니다.
 * 값이 없으면 null(카드에서 생략 가능).
 */
export function profileInstitutionLabel(
  ag: ProfileAgeGroup,
  raw: string | null | undefined,
): string | null {
  if (raw == null || raw === '') {
    return null
  }
  const inst = normalizeInstitutionForAgeGroup(ag, raw)
  if (ag === 'preschool') {
    const map: Record<string, string> = {
      home: '가정보육',
      daycare: '어린이집',
      kindergarten: '유치원',
    }
    return map[inst] ?? null
  }
  const map: Record<string, string> = {
    school: '학교',
    home: '홈스쿨',
  }
  return map[inst] ?? null
}
