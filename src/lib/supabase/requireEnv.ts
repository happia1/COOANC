/**
 * Supabase 클라이언트 생성 전에 URL·anon 키가 있는지 검사합니다.
 * - 값이 비어 있으면 대시보드 링크와 .env.local 안내가 담긴 오류를 던져, 런타임 원인을 빨리 찾을 수 있게 합니다.
 */

export function requireSupabaseUrlAndAnonKey(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!url || !anonKey) {
    const missing: string[] = []
    if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL')
    if (!anonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')

    throw new Error(
      [
        `[Supabase] 다음 환경변수가 없거나 비어 있습니다: ${missing.join(', ')}`,
        '',
        '해결: 프로젝트 루트 `.env.local` 에 아래 두 줄을 채워 주세요. (빈 칸이면 이 오류가 납니다.)',
        '  NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co',
        '  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...',
        '',
        '값 위치: Supabase 대시보드 → Project Settings → API → Project URL / anon public',
        '저장 후 `npm run dev` 를 완전히 종료했다가 다시 실행해 주세요. (Turbopack은 .env 변경 후 재시작이 필요할 수 있습니다.)',
        '',
        '템플릿: `.env.example` 파일을 복사해 `.env.local` 로 써도 됩니다.',
      ].join('\n'),
    )
  }

  return { url, anonKey }
}
