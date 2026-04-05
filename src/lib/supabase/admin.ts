import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * 서버(API 라우트) 전용 Supabase 클라이언트 — service_role 키로 RLS를 우회합니다.
 * - 클라이언트 번들에 포함되면 안 되므로 이 모듈은 서버에서만 import 하세요.
 * - 키가 없으면 null (이때는 일반 createClient() + RLS 정책에 의존)
 */
export function createServiceRoleClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
