import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 콘텐츠 운영자(개발자) 접근 판별.
 *
 * 들어가는 방법은 두 가지입니다.
 *  1) 로그인 화면 맨 아래 「개발자 로그인」에 비밀번호(`CONTENT_ADMIN_PASSWORD`)를 입력 —
 *     별도 계정을 만들 필요가 없어, 이미 부모로 쓰고 있는 계정과 충돌하지 않습니다.
 *  2) 평소 쓰는 계정으로 로그인한 상태에서, 그 이메일이 `CONTENT_ADMIN_EMAILS` 에 들어 있는 경우.
 *
 * 두 값 모두 서버 환경변수라 브라우저로 내려가지 않습니다.
 */

/** 개발자 로그인 성공 시 심는 쿠키 이름 */
export const CONTENT_ADMIN_COOKIE = 'cooanc_content_admin'
/** 개발자 세션 유효 기간(초) — 12시간 */
export const CONTENT_ADMIN_SESSION_MAX_AGE = 12 * 60 * 60

function adminPassword(): string {
  return (process.env.CONTENT_ADMIN_PASSWORD ?? '').trim()
}

function parseAdminEmails(): Set<string> {
  const raw = process.env.CONTENT_ADMIN_EMAILS ?? ''
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
}

/** 길이가 달라도 정보가 새지 않도록 항상 같은 시간에 비교합니다 */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) {
    // 길이가 다르면 어차피 불일치 — 그래도 비교 시간을 맞추기 위해 한 번 수행합니다
    timingSafeEqual(ab, ab)
    return false
  }
  return timingSafeEqual(ab, bb)
}

function sign(payload: string): string {
  return createHmac('sha256', adminPassword()).update(payload).digest('base64url')
}

/**
 * 서버에 개발자 비밀번호가 설정돼 있는지.
 * Vercel 은 환경변수를 추가·수정한 뒤 **다시 배포해야** 값이 반영되므로,
 * "비밀번호가 틀림" 과 "아직 설정 안 됨" 을 구분해 안내하는 데 씁니다.
 */
export function isAdminPasswordConfigured(): boolean {
  return adminPassword().length > 0
}

/** 비밀번호가 맞는지 확인 — 환경변수가 비어 있으면 항상 실패 */
export function verifyAdminPassword(input: unknown): boolean {
  const expected = adminPassword()
  if (!expected) return false
  if (typeof input !== 'string') return false
  /** 모바일 키보드가 끝에 공백을 붙이는 경우가 있어 입력값도 다듬어 비교합니다 */
  const given = input.trim()
  if (given.length === 0) return false
  return safeEqual(given, expected)
}

/** 만료 시각이 담긴 서명 토큰을 만듭니다(비밀번호 자체는 쿠키에 넣지 않음) */
export function createAdminSessionToken(): string {
  const exp = Date.now() + CONTENT_ADMIN_SESSION_MAX_AGE * 1000
  const payload = String(exp)
  return `${payload}.${sign(payload)}`
}

function verifyAdminSessionToken(token: unknown): boolean {
  if (!adminPassword()) return false
  if (typeof token !== 'string') return false
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return false
  const payload = token.slice(0, dot)
  const signature = token.slice(dot + 1)
  if (!safeEqual(signature, sign(payload))) return false
  const exp = Number(payload)
  return Number.isFinite(exp) && Date.now() < exp
}

export type ContentAdminAuthResult =
  | { ok: true; via: 'password' | 'email'; email: string | null }
  | { ok: false; reason: 'unauthenticated' | 'forbidden' }

/**
 * 이 요청이 콘텐츠 운영자 권한을 가졌는지 확인합니다.
 * 개발자 비밀번호 쿠키가 있으면 로그인 계정과 무관하게 통과합니다.
 */
export async function resolveContentAdminUser(
  supabase: SupabaseClient,
): Promise<ContentAdminAuthResult> {
  const cookieStore = await cookies()
  if (verifyAdminSessionToken(cookieStore.get(CONTENT_ADMIN_COOKIE)?.value)) {
    return { ok: true as const, via: 'password' as const, email: null }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { ok: false as const, reason: 'unauthenticated' as const }

  const allow = parseAdminEmails()
  if (!allow.has(user.email.toLowerCase())) {
    return { ok: false as const, reason: 'forbidden' as const }
  }

  return { ok: true as const, via: 'email' as const, email: user.email }
}
