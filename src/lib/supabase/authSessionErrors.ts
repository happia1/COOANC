/**
 * Supabase Auth 오류 중, "이 기기에 남은 세션 쿠키를 지워야 할 때"를 구분합니다.
 *
 * 비개발자 설명: 로그인하면 브라우저에 잠깐 쓰는 열쇠(액세스 토큰)와,
 * 열쇠를 다시 받을 때 쓰는 긴 비밀번호(리프레시 토큰)가 쿠키에 저장됩니다.
 * 긴 비밀번호가 서버에서 이미 무효가 되면(만료·로그아웃·다른 PC에서 재설정 등)
 * 갱신이 계속 실패하면서 콘솔에 AuthApiError 가 뜰 수 있어요.
 * 그때는 깨진 쿠키를 비우고 다시 로그인하게 만드는 편이 안전합니다.
 *
 * 주의: `refresh_token_already_used` 는 보통 "두 탭이 동시에 갱신을 시도"할 때 나옵니다.
 * 이때는 다른 탭이 새 쿠키를 곧 보내 줄 수 있으므로 여기서 로그아웃(쿠키 삭제)을 하지 않습니다.
 */
export function shouldClearAuthCookiesAfterError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const e = error as { message?: string; code?: string | undefined }
  const code = e.code ?? ''

  if (code === 'refresh_token_already_used') return false
  if (code === 'refresh_token_not_found') return true

  const msg = (e.message ?? '').toLowerCase()
  if (msg.includes('refresh token not found')) return true
  if (msg.includes('invalid refresh token')) return true

  return false
}
