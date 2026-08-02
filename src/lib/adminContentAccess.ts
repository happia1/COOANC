import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 콘텐츠 운영자 화면(`/admin/content`) 접근 허용 이메일.
 * 비개발자: 배포 환경변수 `CONTENT_ADMIN_EMAILS` 에 쉼표로 구분해서 이메일을 넣으면
 * 그 계정으로 로그인했을 때만 기본 콘텐츠 라인업(카테고리·채널)을 관리할 수 있습니다.
 * 예) CONTENT_ADMIN_EMAILS=happia1@nate.com
 */
function parseAdminEmails(): Set<string> {
  const raw = process.env.CONTENT_ADMIN_EMAILS ?? ''
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
}

export type ContentAdminAuthResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; reason: 'unauthenticated' | 'forbidden' }

/** 로그인한 사용자가 콘텐츠 운영자 허용목록에 있는지 확인합니다. */
export async function resolveContentAdminUser(
  supabase: SupabaseClient,
): Promise<ContentAdminAuthResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { ok: false, reason: 'unauthenticated' }

  const allow = parseAdminEmails()
  if (!allow.has(user.email.toLowerCase())) return { ok: false, reason: 'forbidden' }

  return { ok: true, userId: user.id, email: user.email }
}
