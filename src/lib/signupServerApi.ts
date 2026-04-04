/**
 * 클라이언트 signUp 이 막힐 때(예: User not allowed, DB 트리거 오류) 사용하는
 * 서버 API(/api/auth/signup) 호출입니다. service_role 로 사용자를 생성합니다.
 */
import { parseJsonFromResponse } from '@/lib/parseJsonResponse'

export type ServerSignupResult =
  | { ok: true; userId?: string; hasSession: boolean }
  | { ok: false; error: string }

export async function signupViaServerApi(
  email: string,
  password: string,
  name: string,
): Promise<ServerSignupResult> {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  })

  const { data: json, parseError } = await parseJsonFromResponse<Record<string, unknown>>(res)
  const payload = json ?? {}

  if (parseError) {
    return { ok: false, error: '서버 응답을 읽을 수 없어요. 잠시 후 다시 시도해 주세요.' }
  }

  if (!res.ok) {
    const errMsg =
      typeof payload.error === 'string' ? payload.error : '회원가입에 실패했어요. 잠시 후 다시 시도해 주세요.'
    return { ok: false, error: errMsg }
  }

  const userId = typeof payload.userId === 'string' ? payload.userId : undefined
  const hasSession = Boolean(payload.session)
  return { ok: true, userId, hasSession }
}
