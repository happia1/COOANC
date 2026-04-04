/**
 * Supabase 클라이언트 auth.signUp 이 실패했을 때,
 * 서버(service_role) 경유 재시도가 의미 있는 경우를 판별합니다.
 *
 * - "User not allowed": 대시보드에서 공개 이메일 가입이 꺼져 있을 때 자주 발생
 * - "Database error": profiles 트리거 등 DB 쪽 오류 시
 */
export function shouldUseServerSignupFallback(message: string): boolean {
  const m = message.toLowerCase()
  return (
    message.includes('Database error') ||
    message.includes('User not allowed') ||
    m.includes('signups not allowed') ||
    m.includes('signup is disabled') ||
    m.includes('email signups are disabled') ||
    m.includes('signup disabled')
  )
}
