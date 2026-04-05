/**
 * 부모 화면에서 연결된 자녀 profiles 행을 가져올 때 사용합니다.
 *
 * 로컬/스테이징 DB 가 마이그레이션 단계마다 달라 `age`, `birth_date`, `avatar_url` 중 일부만 있을 수 있어요.
 * PostgREST 는 존재하지 않는 컬럼을 select 하면 전체 요청이 실패하므로,
 * 컬럼 조합을 **짧은 것부터가 아니라 풍부한 순 → 실패 시 다음 조합**으로 순차 시도합니다.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type ChildProfileRow = {
  id: string
  name: string
  age: number | null
  avatar_url: string | null
  birth_date: string | null
}

/** Postgres undefined_column 또는 "column ... does not exist" 류 — 다른 오류(RLS 등)와 구분 */
export function isRetriableMissingColumnError(err: { message?: string; code?: string; details?: string }): boolean {
  const code = String(err.code ?? '')
  const blob = `${err.message ?? ''} ${err.details ?? ''}`.toLowerCase()
  if (code === '42703') return true
  if (blob.includes('column') && blob.includes('does not exist')) return true
  return false
}

/** @deprecated API 호환용 — birth_date 전용이 아니라 위와 동일하게 취급 */
export function isMissingBirthDateColumnError(err: { message?: string; code?: string; details?: string }): boolean {
  return isRetriableMissingColumnError(err)
}

function normalizeChildProfileRow(r: Record<string, unknown>): ChildProfileRow {
  return {
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    age: typeof r.age === 'number' && !Number.isNaN(r.age) ? r.age : null,
    avatar_url: typeof r.avatar_url === 'string' ? r.avatar_url : null,
    birth_date: typeof r.birth_date === 'string' ? r.birth_date : null,
  }
}

/** 부모 홈: 자녀 여러 명 */
const HOME_PROFILE_SELECTS = [
  'id, name, age, avatar_url, birth_date',
  'id, name, age, avatar_url',
  'id, name, avatar_url, birth_date',
  'id, name, avatar_url',
  'id, name',
] as const

/**
 * @returns rows — 성공 시 자녀 프로필 배열(0명도 가능). 완전 실패 시 null.
 */
export async function selectChildProfilesByIds(
  supabase: SupabaseClient,
  childIds: string[],
): Promise<{ rows: ChildProfileRow[] | null; error: { message: string } | null }> {
  if (childIds.length === 0) {
    return { rows: [], error: null }
  }

  for (const cols of HOME_PROFILE_SELECTS) {
    const res = await supabase.from('profiles').select(cols).in('id', childIds)
    if (!res.error && res.data) {
      return {
        rows: (res.data as unknown as Record<string, unknown>[]).map(normalizeChildProfileRow),
        error: null,
      }
    }
    if (res.error && !isRetriableMissingColumnError(res.error)) {
      return { rows: null, error: { message: res.error.message } }
    }
  }

  return { rows: null, error: { message: 'profiles 조회: 사용 가능한 컬럼 조합을 찾지 못했어요.' } }
}

export type ChildProfileDetailRow = {
  id: string
  name: string
  role: string
  age: number | null
  birth_date: string | null
  avatar_url: string | null
  created_at: string
}

function normalizeDetailRow(r: Record<string, unknown>): ChildProfileDetailRow {
  return {
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    role: String(r.role ?? ''),
    age: typeof r.age === 'number' && !Number.isNaN(r.age) ? r.age : null,
    birth_date: typeof r.birth_date === 'string' ? r.birth_date : null,
    avatar_url: typeof r.avatar_url === 'string' ? r.avatar_url : null,
    created_at: typeof r.created_at === 'string' ? r.created_at : '',
  }
}

const DETAIL_PROFILE_SELECTS = [
  'id, name, role, age, birth_date, avatar_url, created_at',
  'id, name, role, age, avatar_url, created_at',
  'id, name, role, birth_date, avatar_url, created_at',
  'id, name, role, avatar_url, created_at',
  'id, name, role, age, created_at',
  'id, name, role, created_at',
  'id, name, created_at',
  'id, name, role',
  'id, name',
] as const

/** 자녀 상세 페이지용 — 단일 행 */
export async function selectChildProfileDetailById(
  supabase: SupabaseClient,
  childId: string,
): Promise<{ data: ChildProfileDetailRow | null; error: { message: string } | null }> {
  for (const cols of DETAIL_PROFILE_SELECTS) {
    const res = await supabase.from('profiles').select(cols).eq('id', childId).maybeSingle()
    if (!res.error) {
      if (!res.data) return { data: null, error: null }
      return { data: normalizeDetailRow(res.data as unknown as Record<string, unknown>), error: null }
    }
    if (!isRetriableMissingColumnError(res.error)) {
      return { data: null, error: { message: res.error.message } }
    }
  }

  return { data: null, error: { message: 'profiles 조회: 사용 가능한 컬럼 조합을 찾지 못했어요.' } }
}
