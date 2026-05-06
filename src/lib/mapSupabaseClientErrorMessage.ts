/**
 * 브라우저 Supabase 클라이언트가 받은 오류 문자열을, 사용자에게 읽히는 문구로 바꿉니다.
 *
 * 비개발자 설명:
 * - `NEXT_PUBLIC_SUPABASE_URL` 이 잘못되면(예: 다른 웹 주소를 적음) 프로그램은 JSON 이라고 기대하는데
 *   실제로는 웹페이지 글자(HTML, `<` 로 시작)가 와요. 이때 브라우저는 「Unexpected token '<'」처럼 말합니다.
 * - 원인 안내 문구로 바꿔 주면 `.env.local` 을 고칠 수 있어요.
 */
export function mapSupabaseClientErrorMessage(raw: string): string {
  if (/Unexpected token|DOCTYPE|<!DOCTYPE|not valid JSON|is not valid JSON/i.test(raw)) {
    return (
      'Supabase 주소 또는 키가 잘못된 것 같아요. ' +
      '프로젝트 루트 `.env.local` 의 NEXT_PUBLIC_SUPABASE_URL(…supabase.co) 과 ' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY 를 확인한 뒤, 개발 서버를 완전히 껐다가 다시 켜 주세요.'
    )
  }
  return raw
}
