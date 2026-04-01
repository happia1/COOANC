import { createBrowserClient } from '@supabase/ssr'

/**
 * 브라우저 환경에서 Supabase와 통신하기 위한 클라이언트 생성
 * NEXT_PUBLIC_ 접두사가 붙은 환경 변수는 브라우저에 노출됩니다.
 */
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
