import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  SUPABASE_SERVER_FETCH_TIMEOUT_MS,
  wrapFetchWithTimeout,
} from '@/lib/supabase/fetchWithTimeout'

/**
 * 서버 전용 env 문자열 정리 — 복사·붙여넣기로 생기는 흔한 오류를 줄입니다.
 * - 앞뒤 공백
 * - UTF-8 BOM (문서 첫 글자로 붙는 경우)
 * - 전체를 감싼 따옴표 한 쌍
 */
function cleanServerEnvValue(raw: string | undefined): string {
  if (raw == null) return ''
  let s = String(raw).trim()
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1).trim()
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim()
  }
  return s
}

function firstNonEmpty(...candidates: (string | undefined)[]): string {
  for (const c of candidates) {
    const t = cleanServerEnvValue(c)
    if (t) return t
  }
  return ''
}

/**
 * 서버 API용 Supabase Project URL + service_role 키.
 * - 팀마다 `.env` 이름이 조금 다를 수 있어 후보를 순서대로 읽습니다.
 *   URL: `NEXT_PUBLIC_SUPABASE_URL` → `SUPABASE_URL`(Supabase CLI 등)
 *   키: `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_KEY`(일부 스크립트 명명)
 */
export function resolveSupabaseServiceRoleEnv(): { url: string; key: string } | null {
  const url = firstNonEmpty(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_URL)
  const key = firstNonEmpty(process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SERVICE_KEY)
  if (!url || !key) return null
  return { url, key }
}

/** API 500 응답용 — 어떤 항목이 비었는지 짧게 알려 줍니다(값 자체는 노출하지 않음). */
export function serviceRoleEnvMissingMessage(): string {
  const url = firstNonEmpty(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_URL)
  const key = firstNonEmpty(process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SERVICE_KEY)
  const miss: string[] = []
  if (!url) miss.push('Project URL(NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_URL)')
  if (!key) miss.push('service_role 키(SUPABASE_SERVICE_ROLE_KEY 또는 SUPABASE_SERVICE_KEY)')
  return miss.length > 0 ? `다음이 비어 있거나 읽히지 않습니다: ${miss.join(', ')}.` : ''
}

/**
 * 서버(API 라우트) 전용 Supabase 클라이언트 — service_role 키로 RLS를 우회합니다.
 * - 클라이언트 번들에 포함되면 안 되므로 이 모듈은 서버에서만 import 하세요.
 * - 키·URL이 없으면 null (이때는 일반 createClient() + RLS 정책에 의존)
 */
export function createServiceRoleClient(): SupabaseClient | null {
  const env = resolveSupabaseServiceRoleEnv()
  if (!env) return null
  return createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: wrapFetchWithTimeout(fetch, SUPABASE_SERVER_FETCH_TIMEOUT_MS),
    },
  })
}
