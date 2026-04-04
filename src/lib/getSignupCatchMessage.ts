/**
 * 회원가입 try/catch 에서 잡힌 예외를 사용자에게 보여줄 문구로 바꿉니다.
 * - 진짜 네트워크/연결 실패는 짧은 안내 유지
 * - 그 외(설정 오류, Supabase 예외 등)는 메시지를 노출해 원인 파악이 가능하게 함
 */
export function getSignupCatchMessage(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'object' &&
          err !== null &&
          'message' in err &&
          typeof (err as { message: unknown }).message === 'string'
        ? (err as { message: string }).message
        : null

  if (!raw) {
    return '가입 처리 중 오류가 있어요. 잠시 후 다시 시도해 주세요.'
  }

  const lower = raw.toLowerCase()
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed') ||
    lower.includes('network request failed') ||
    lower.includes('fetch failed')
  ) {
    return '네트워크 오류가 발생했어요. 인터넷 연결을 확인해 주세요.'
  }

  return `가입 처리 중 문제가 있어요: ${raw}`
}
